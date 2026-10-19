"""Print a Linux container memory snapshot without importing application packages."""
import json
from pathlib import Path


def snapshot() -> dict:
    processes = []
    for directory in Path("/proc").iterdir():
        if not directory.name.isdigit():
            continue
        try:
            status = (directory / "status").read_text().splitlines()
            rss = next((int(line.split()[1]) for line in status if line.startswith("VmRSS:")), 0)
            processes.append({"pid": int(directory.name), "name": (directory / "comm").read_text().strip(), "rssMiB": round(rss / 1024, 1)})
        except (OSError, ValueError):
            continue
    result = {"processes": processes}
    for name in ("memory.current", "memory.peak", "memory.max", "memory.events"):
        path = Path("/sys/fs/cgroup") / name
        if path.exists():
            result[name] = path.read_text().strip()
    return result


if __name__ == "__main__":
    print(json.dumps(snapshot(), indent=2))
