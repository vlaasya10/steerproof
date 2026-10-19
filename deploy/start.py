"""Run the colocated backend services; exit if any service fails."""
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen


def ready(url: str) -> bool:
    try:
        with urlopen(url, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False


def main() -> int:
    required = ("GEMINI_API_KEY", "DB_URL", "DB_USER", "DB_PASSWORD", "DEPLOYMENT_ACCESS_KEY", "CORS_ALLOWED_ORIGINS")
    missing = [name for name in required if not os.environ.get(name, "").strip()]
    if missing:
        print("Missing deployment settings: " + ", ".join(missing), flush=True)
        return 1
    if len(os.environ["DEPLOYMENT_ACCESS_KEY"].strip()) < 32 or os.environ["DEPLOYMENT_ACCESS_KEY"].startswith("replace-"):
        print("DEPLOYMENT_ACCESS_KEY must contain at least 32 characters", flush=True)
        return 1
    if any(origin.strip() == "*" for origin in os.environ["CORS_ALLOWED_ORIGINS"].split(",")):
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

    stopped = False
    children: list[subprocess.Popen] = []

    def stop(signum: int, frame: object) -> None:
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    env = os.environ.copy()
    env.setdefault("DEMO_MODE", "false")
    env.setdefault("ML_SERVICE_URL", "http://127.0.0.1:8001")
    env.setdefault("RENDER_SERVICE_URL", "http://127.0.0.1:8002")
    try:
        children.append(subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"], cwd="/app/ml-service", env=env))
        children.append(subprocess.Popen(["node", "--import", "tsx", "src/server.ts"], cwd="/app/render-service", env={**env, "PORT": "8002", "HOST": "127.0.0.1"}))
        deadline = time.monotonic() + 180
        while not all(ready(url) for url in ("http://127.0.0.1:8001/health", "http://127.0.0.1:8002/health")):
            if stopped or any(child.poll() is not None for child in children) or time.monotonic() > deadline:
                raise RuntimeError("Internal services did not become healthy; inspect startup logs")
            time.sleep(1)
        children.append(subprocess.Popen(["java", "-XX:MaxRAMPercentage=25.0", "-jar", "/app/backend/app.jar", "--server.port=" + env.get("PORT", "10000")], cwd="/app/backend", env=env))
        while not stopped:
            if any(child.poll() is not None for child in children):
                raise RuntimeError("A backend service exited; stopping the container")
            time.sleep(1)
        return 0
    except Exception as error:
        print(str(error), flush=True)
        return 1
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
    sys.exit(main())
