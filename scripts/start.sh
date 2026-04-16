#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
PID_DIR="$ROOT_DIR/.run"
mkdir -p "$PID_DIR"

command -v uv >/dev/null || { echo "ERROR: uv not found. Install from https://docs.astral.sh/uv/getting-started/"; exit 1; }

# Best-effort cleanup of stale processes from prior runs.
bash "$ROOT_DIR/scripts/stop.sh" >/dev/null 2>&1 || true

find_frontend_port() {
  local port
  for port in 3000 3001 3002 3003 3004 3005; do
    if curl --max-time 2 -sf "http://localhost:${port}" >/dev/null; then
      echo "$port"
      return 0
    fi
  done
  return 1
}

if ! curl -sf http://localhost:9090/-/healthy >/dev/null \
  || ! curl -sf http://localhost:3100/ready >/dev/null \
  || ! curl -sf http://localhost:3200/ready >/dev/null; then
  bash "$ROOT_DIR/scripts/port_forward.sh"
fi

cd "$ROOT_DIR/backend"

# Create venv if missing
if [ ! -d venv ]; then
  echo "Creating venv with Python 3.12..."
  uv venv --python 3.12 venv
fi

source venv/bin/activate

# Install/sync dependencies with uv
echo "Installing dependencies..."
uv pip install -r requirements.txt 2>&1 | tee /tmp/t3ps2-pip.log || {
  echo "Backend dependency install failed. Check /tmp/t3ps2-pip.log"
  exit 1
}

if [ ! -f data/t3ps2.db ]; then
  python init_db.py
fi

# Run the same entrypoint used in manual local runs.
python main.py &
BACKEND_PID=$!
cd "$ROOT_DIR"

sleep 2
backend_ready=false
for _ in {1..20}; do
  if curl --max-time 2 -sf http://localhost:8000/healthz >/dev/null; then
    backend_ready=true
    break
  fi
  sleep 1
done

if [ "$backend_ready" != "true" ]; then
  echo "ERROR: backend failed health check; check logs and retry."
  exit 1
fi

curl --max-time 5 -sf -X POST http://localhost:8000/admin/load-scenarios >/dev/null || true

cd "$ROOT_DIR/frontend"
npm install
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

frontend_port=""
for _ in {1..30}; do
  if frontend_port="$(find_frontend_port)"; then
    break
  fi
  sleep 1
done

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "$BACKEND_PID" > "$PID_DIR/backend.pid"
echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"

echo ""
echo "=== Local Endpoints ==="
echo "Backend API:        http://localhost:8000"
echo "Backend health:     http://localhost:8000/healthz"
echo "Backend docs:       http://localhost:8000/docs"

if [ -n "$frontend_port" ]; then
  echo "Frontend (Next.js): http://localhost:${frontend_port}"
else
  echo "Frontend (Next.js): not detected yet (check npm logs)"
fi

echo "Prometheus:         http://localhost:9090"
echo "Grafana:            http://localhost:3300"
echo "Loki API:           http://localhost:3100/ready"
echo "Tempo API:          http://localhost:3200/ready"
echo ""

echo "Press Ctrl+C to stop."
trap "bash \"$ROOT_DIR/scripts/stop.sh\" >/dev/null 2>&1; exit 0" SIGINT SIGTERM
wait