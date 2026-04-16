#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cd "$ROOT_DIR/backend"
rm -f data/t3ps2.db
python init_db.py
cd "$ROOT_DIR"

if curl -sf http://localhost:8000/healthz >/dev/null; then
	curl -sf -X POST http://localhost:8000/admin/load-scenarios >/dev/null
else
	echo "Backend not running; scenarios will load on next start."
fi

kubectl rollout restart deployment/payment-api -n prod || true
kubectl rollout restart deployment/auth-service -n prod || true
kubectl rollout restart deployment/api-service -n prod || true
kubectl delete pod cpu-stress -n prod --ignore-not-found || true

echo "Reset complete."
