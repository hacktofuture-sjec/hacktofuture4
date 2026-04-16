#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pkill -f "kubectl port-forward" >/dev/null 2>&1 || true
sleep 1

kubectl port-forward svc/prometheus-server 9090:80 -n monitoring >/tmp/pf-prometheus.log 2>&1 &
echo "Prometheus port-forward started (PID $!)"

kubectl port-forward svc/loki 3100:3100 -n monitoring >/tmp/pf-loki.log 2>&1 &
echo "Loki port-forward started (PID $!)"

kubectl port-forward svc/tempo 3200:3200 -n monitoring >/tmp/pf-tempo.log 2>&1 &
echo "Tempo port-forward started (PID $!)"

kubectl port-forward svc/grafana 3300:80 -n monitoring >/tmp/pf-grafana.log 2>&1 &
echo "Grafana port-forward started (PID $!)"

sleep 2
for url in "http://localhost:9090/-/healthy" "http://localhost:3100/ready" "http://localhost:3200/ready" "http://localhost:3300/api/health"; do
  if curl -sf "$url" >/dev/null; then
    echo "OK $url"
  else
    echo "WARN $url not reachable"
  fi
done
