#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pkill -f "uvicorn main:app" >/dev/null 2>&1 && echo "Backend stopped" || echo "Backend not running"
pkill -f "next dev" >/dev/null 2>&1 && echo "Frontend stopped" || echo "Frontend not running"
pkill -f "kubectl port-forward" >/dev/null 2>&1 && echo "Port-forwards stopped" || true
