#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HELM_TIMEOUT="${HELM_TIMEOUT:-8m}"
HELM_RETRIES="${HELM_RETRIES:-3}"

dump_monitoring_diagnostics() {
  echo "=== Monitoring diagnostics (pods) ==="
  kubectl get pods -n monitoring -o wide || true
  echo "=== Monitoring diagnostics (recent events) ==="
  kubectl get events -n monitoring --sort-by=.lastTimestamp | tail -n 80 || true
}

helm_upgrade_with_retry() {
  local release="$1"
  local chart="$2"
  local values_file="$3"
  local retries="$4"

  local attempt=1
  while [ "$attempt" -le "$retries" ]; do
    echo "=== Helm install/upgrade: ${release} (attempt ${attempt}/${retries}) ==="
    if helm upgrade --install "$release" "$chart" \
      --namespace monitoring \
      -f "$values_file" \
      --wait --timeout "$HELM_TIMEOUT"; then
      return 0
    fi

    echo "WARN: ${release} deployment attempt ${attempt} failed."
    dump_monitoring_diagnostics
    if [ "$attempt" -lt "$retries" ]; then
      sleep $((attempt * 20))
    fi
    attempt=$((attempt + 1))
  done

  echo "ERROR: ${release} failed after ${retries} attempts."
  return 1
}

echo "=== Checking prerequisites ==="
command -v docker >/dev/null || { echo "ERROR: docker not found"; exit 1; }
command -v kubectl >/dev/null || { echo "ERROR: kubectl not found"; exit 1; }
command -v kind >/dev/null || { echo "ERROR: kind not found"; exit 1; }
command -v helm >/dev/null || { echo "ERROR: helm not found"; exit 1; }
command -v vcluster >/dev/null || { echo "ERROR: vcluster not found"; exit 1; }
command -v uv >/dev/null || { echo "ERROR: uv not found. Install from https://docs.astral.sh/uv/getting-started/"; exit 1; }

echo "=== Installing Python 3.12 with uv ==="
if ! python3.12 --version >/dev/null 2>&1; then
  uv python install 3.12
else
  echo "Python 3.12 already installed."
fi

echo "=== Creating Kind cluster ==="
if kind get clusters | grep -q "^t3ps2$"; then
  echo "Cluster t3ps2 already exists."
else
  kind create cluster --name t3ps2 --config k8s/kind-config.yaml
fi

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts || true
helm repo add grafana https://grafana.github.io/helm-charts || true
helm repo update

kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace prod --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace vcluster-sandboxes --dry-run=client -o yaml | kubectl apply -f -

helm_upgrade_with_retry "prometheus" "prometheus-community/prometheus" "k8s/monitoring/prometheus-values.yaml" "$HELM_RETRIES"

helm_upgrade_with_retry "loki" "grafana/loki-stack" "k8s/monitoring/loki-values.yaml" "$HELM_RETRIES"

helm_upgrade_with_retry "tempo" "grafana/tempo" "k8s/monitoring/tempo-values.yaml" "$HELM_RETRIES"

helm_upgrade_with_retry "grafana" "grafana/grafana" "k8s/monitoring/grafana-values.yaml" "$HELM_RETRIES"

kubectl apply -f k8s/demo-app-config.yaml
kubectl apply -f k8s/payment-api.yaml
kubectl apply -f k8s/auth-service.yaml
kubectl apply -f k8s/api-service.yaml

wait_for_rollout() {
  local deployment_name="$1"
  echo "=== Waiting for ${deployment_name} rollout ==="
  kubectl rollout status deployment/${deployment_name} -n prod --timeout=5m
}

wait_for_rollout auth-service
wait_for_rollout payment-api
wait_for_rollout api-service

kubectl wait --for=condition=ready pod --all -n monitoring --timeout=600s

bash "$ROOT_DIR/scripts/port_forward.sh"

echo ""  
echo "=== Backend Python environment ==="
echo "Creating Python 3.12 venv for backend..."
cd "$ROOT_DIR/backend"
uv venv --python 3.12 venv
echo "Venv created. Backend ready for 'start.sh'."

echo ""
echo "Setup complete. Next: run './start.sh' from repo root."