#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

sleep 3
curl -sf http://localhost:8000/healthz >/dev/null

curl -sf -X POST http://localhost:8000/admin/load-scenarios >/dev/null || true

cd "$ROOT_DIR/frontend"
npm install
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

echo "Press Ctrl+C to stop."
trap "kill $BACKEND_PID $FRONTEND_PID >/dev/null 2>&1; exit 0" SIGINT SIGTERM
wait
