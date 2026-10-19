"""Start the public API independently; colocate processors only with enough memory."""
import os
import signal
import subprocess
import sys
import time
from pathlib import Path


def memory_limit_mb() -> int | None:
    limits: list[int] = []
    for name in ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        try:
            value = int(Path(name).read_text().strip())
            if 0 < value < 2**60:
                limits.append(value // (1024 * 1024))
        except (OSError, ValueError):
            pass
    if os.environ.get("MEMORY_LIMIT_MB"):
        declared = int(os.environ["MEMORY_LIMIT_MB"])
        if declared <= 0:
            raise ValueError("MEMORY_LIMIT_MB must be positive")
        limits.append(declared)
    return min(limits) if limits else None


def processing_mode(requested: str, limit_mb: int | None, on_render: bool) -> str:
    if requested not in ("auto", "api", "full"):
        raise ValueError("PROCESSING_MODE must be auto, api or full")
    # Even importing Docling/Torch exceeds the Free budget. Do not attempt it.
    if limit_mb is not None and limit_mb < 1536:
        return "api"
    if requested == "auto":
        return "api" if on_render and limit_mb is None else "full"
    return requested


def java_command(mode: str, port: str) -> list[str]:
    options = (["-Xms48m", "-Xmx160m", "-XX:MaxMetaspaceSize=128m",
                "-XX:ReservedCodeCacheSize=32m", "-XX:MaxDirectMemorySize=16m",
                "-Xss512k", "-XX:+UseSerialGC", "-XX:ActiveProcessorCount=2"]
               if mode == "api" else ["-XX:MaxRAMPercentage=25.0"])
    return ["java", *options, "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/backend/app.jar",
            "--server.address=0.0.0.0", "--server.port=" + port]


def main() -> int:
    limit = memory_limit_mb()
    requested = os.environ.get("PROCESSING_MODE", "auto").lower()
    mode = processing_mode(requested, limit, bool(os.environ.get("RENDER")))
    print(f"Processing mode: {mode}; requested: {requested}; memory limit: {limit} MiB", flush=True)
    required = ["DB_URL", "DB_USER", "DB_PASSWORD", "DEPLOYMENT_ACCESS_KEY", "CORS_ALLOWED_ORIGINS"]
    if mode == "full":
        required.append("GEMINI_API_KEY")
    missing = [name for name in required if not os.environ.get(name, "").strip()]
    if missing:
        print("Missing deployment settings: " + ", ".join(missing), flush=True)
        return 1
    if len(os.environ["DEPLOYMENT_ACCESS_KEY"].strip()) < 32 or os.environ["DEPLOYMENT_ACCESS_KEY"].startswith("replace-"):
        print("DEPLOYMENT_ACCESS_KEY must contain at least 32 characters", flush=True)
        return 1
    if any("*" in origin for origin in os.environ["CORS_ALLOWED_ORIGINS"].split(",")):
        print("Configure exact frontend origins, not a wildcard", flush=True)
        return 1
    storage = Path(os.environ["STORAGE_DIR"])
    directories = [storage, storage / "cache", Path(os.environ["XDG_CACHE_HOME"]),
                   Path(os.environ["HF_HOME"]), Path(os.environ["LLM_CACHE_DIR"])]
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        if os.geteuid() == 0:
            os.chown(directory, 10001, 10001)
    if os.geteuid() == 0:
        os.setgroups([])
        os.setgid(10001)
        os.setuid(10001)
    env = os.environ.copy()
    env["PROCESSING_MODE"] = mode
    env.setdefault("STORAGE_EPHEMERAL", "true")
    env.setdefault("DEMO_MODE", "false")
    env.setdefault("ML_SERVICE_URL", "http://127.0.0.1:8001")
    env.setdefault("RENDER_SERVICE_URL", "http://127.0.0.1:8002")
    command = java_command(mode, env.get("PORT", "10000"))
    if mode == "api":
        print("Starting public API only. PDF/ML/image/video processing requires full mode on a larger machine.", flush=True)
        os.chdir("/app/backend")
        os.execvpe(command[0], command, env)

    stopped = False
    children: list[subprocess.Popen] = []

    def stop(signum: int, frame: object) -> None:
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        # Public HTTP never waits for worker health or a Remotion bundle.
        api = subprocess.Popen(command, cwd="/app/backend", env=env)
        children.append(api)
        children.append(subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"], cwd="/app/ml-service", env=env))
        children.append(subprocess.Popen(["node", "--import", "tsx", "src/server.ts"], cwd="/app/render-service", env={**env, "PORT": "8002", "HOST": "127.0.0.1"}))
        reported: set[int] = set()
        while not stopped:
            if api.poll() is not None:
                raise RuntimeError("Public API exited; stopping container")
            for child in children[1:]:
                if child.poll() is not None and child.pid not in reported:
                    reported.add(child.pid)
                    print(f"Optional processor PID {child.pid} exited with {child.returncode}; API remains available. Processing requests will fail explicitly.", flush=True)
            time.sleep(1)
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        deadline = time.monotonic() + 25
        for child in children:
            try:
                child.wait(timeout=max(0.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(str(error), flush=True)
        sys.exit(1)
