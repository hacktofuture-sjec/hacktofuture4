Ok I am Kushal, My work is on Observation layer (Prometheus, Loki, Tempo, K8s Events), signal intelligence, memory | Infra setup and scenario determinism | Remediation execution and recovery proof, I want you to first go through the entire docs to get the context and understand the project, the branch is already created, then I want you to read to README.md to understand what my work is to do, respective to what is written in the README for my task and go through the docs and implement as told by the docs, fixes we shall see later during testing, but follow the respective docs for my tasks as it is, the setup, file creation, everything as it is, do not deviate to any other issue or domain, we will work only my o#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
PID_DIR="$ROOT_DIR/.run"
mkdir -p "$PID_DIR"

command -v uv >/dev/null || { echo "ERROR: uv not found. Install from https://docs.astral.sh/uv/getting-started/"; exit 1; }

if ! curl -sf http://localhost:9090/-/healthy >/dev/null; then
  bash "$ROOT_DIR/scripts/port_forward.sh"
fi

cd "$ROOT_DIR/backend"

# Create or update venv with Python 3.12 via uv
if [ -d venv ]; then
  echo "Removing existing venv..."
  rm -rf venv
fi

echo "Creating venv with Python 3.12..."
uv venv --python 3.12 venv

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

uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
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
  echo "WARN: backend health check did not respond in time; continuing startup."
fi

curl --max-time 5 -sf -X POST http://localhost:8000/admin/load-scenarios >/dev/null || true

cd "$ROOT_DIR/frontend"
npm install
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "$BACKEND_PID" > "$PID_DIR/backend.pid"
echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"

echo "Press Ctrl+C to stop."
trap "bash \"$ROOT_DIR/scripts/stop.sh\" >/dev/null 2>&1; exit 0" SIGINT SIGTERM
wait