#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_backend_python() {
	if [ -x "$ROOT_DIR/backend/venv/bin/python" ]; then
		"$ROOT_DIR/backend/venv/bin/python" "$@"
		return
	fi

	if command -v python3 >/dev/null 2>&1; then
		python3 "$@"
		return
	fi

	if command -v python >/dev/null 2>&1; then
		python "$@"
		return
	fi

	echo "ERROR: no Python interpreter found (tried backend/venv/bin/python, python3, python)."
	exit 1
}

cd "$ROOT_DIR/backend"
rm -f data/t3ps2.db
run_backend_python init_db.py
cd "$ROOT_DIR"

kubectl apply -f "$ROOT_DIR/k8s/payment-api.yaml" >/dev/null 2>&1 || true
kubectl apply -f "$ROOT_DIR/k8s/auth-service.yaml" >/dev/null 2>&1 || true
kubectl apply -f "$ROOT_DIR/k8s/api-service.yaml" >/dev/null 2>&1 || true
kubectl delete pod cpu-stress -n prod --ignore-not-found >/dev/null 2>&1 || true

if curl -sf http://localhost:8000/healthz >/dev/null; then
	curl -sf -X POST http://localhost:8000/admin/load-scenarios >/dev/null
else
	echo "Backend not running; scenarios will load on next start."
fi

echo "Reset complete."
