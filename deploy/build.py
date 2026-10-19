"""Build from an allowlisted context without traversing local data or environments."""
import argparse
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", default="steerproof-deploy:local")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    directories = ("deploy", "backend/src/main", "ml-service/app", "render-service/src",
                   "render-service/templates", "render-service/remotion", "render-service/assets", "demo/papers")
    files = ("Dockerfile", ".dockerignore", "backend/pom.xml", "ml-service/requirements.txt",
             "render-service/package.json", "render-service/package-lock.json", "render-service/tsconfig.json")
    cache = root / ".cache" / "deployment"
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="context-", dir=cache) as temporary:
        archive_path = Path(temporary) / "context.tar.gz"
        with tarfile.open(archive_path, "w:gz") as archive:
            for name in files:
                archive.add(root / name, arcname=name)
            for name in directories:
                for current, folders, filenames in os.walk(root / name):
                    folders[:] = [folder for folder in folders if folder not in ("__pycache__", "node_modules", ".venv") and not (Path(current) / folder).is_symlink()]
                    for filename in filenames:
                        path = Path(current) / filename
                        if path.is_symlink() or filename.startswith(".env") or filename.endswith((".env", ".log", ".pyc")):
                            continue
                        archive.add(path, arcname=path.relative_to(root).as_posix())
        subprocess.run(["docker", "build", "--progress=plain", "--file", "Dockerfile", "--tag", args.tag, "-"],
                       input=archive_path.read_bytes(), check=True)


if __name__ == "__main__":
    main()
