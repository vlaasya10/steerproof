import os
import sys
from urllib.request import urlopen

try:
    for url in (f"http://127.0.0.1:{os.environ.get('PORT', '10000')}/actuator/health",
                "http://127.0.0.1:8001/health", "http://127.0.0.1:8002/health"):
        with urlopen(url, timeout=3) as response:
            if response.status != 200:
                sys.exit(1)
except Exception:
    sys.exit(1)
