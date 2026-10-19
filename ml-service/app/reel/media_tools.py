"""Resolve system media tools or the binaries bundled with the render service."""
import os
import platform
import shutil
import sys
from pathlib import Path


def media_executable(name: str) -> str:
    configured = os.environ.get(f"{name.upper()}_PATH")
    executable = shutil.which(configured or name)
    if executable:
        return executable
    if configured:
        raise RuntimeError(f"{name.upper()}_PATH does not point to an executable")

    architecture = "arm64" if platform.machine().lower() in ("arm64", "aarch64") else "x64"
    filename = f"{name}.exe" if sys.platform == "win32" else name
    packages = Path(__file__).resolve().parents[3] / "render-service" / "node_modules" / "@remotion"
    for package in packages.glob(f"compositor-{sys.platform}-{architecture}*"):
        candidate = package / filename
        if candidate.is_file():
            return str(candidate)
    raise RuntimeError(
        f"{name} is unavailable. Install render-service dependencies or configure {name.upper()}_PATH."
    )
