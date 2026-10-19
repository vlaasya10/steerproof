import os
import sys
from urllib.request import urlopen

try:
    # Spring + PostgreSQL readiness, independent of the optional processors.
    for url in (f"http://127.0.0.1:{os.environ.get('PORT', '10000')}/actuator/health",):
        with urlopen(url, timeout=3) as response:
            if response.status != 200:
                sys.exit(1)
except (OSError, ValueError):
    sys.exit(1)
