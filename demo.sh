#!/usr/bin/env bash
# Hackathon demo: POST a sample failing CI log to the local webhook.
# Usage: ./demo.sh [webhook_url]
#   PIPELINEMEDIC_URL=http://127.0.0.1:8000 ./demo.sh

set -euo pipefail
URL="${1:-${PIPELINEMEDIC_URL:-http://127.0.0.1:8000}/webhook}"

exec python3 - "$URL" <<'PY'
import json, sys, urllib.request

url = sys.argv[1]
body = json.dumps(
    {
        "repository": "demo/hackathon",
        "log": "ModuleNotFoundError: No module named 'requests'",
    }
).encode("utf-8")
req = urllib.request.Request(
    url,
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as resp:
    raw = resp.read().decode("utf-8", errors="replace")
try:
    print(json.dumps(json.loads(raw), indent=2))
except json.JSONDecodeError:
    print(raw)
PY
