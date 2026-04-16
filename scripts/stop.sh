#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
PID_DIR="$ROOT_DIR/.run"

stop_pid_file() {
	local pid_file="$1"
	local label="$2"
	if [ ! -f "$pid_file" ]; then
		echo "$label not running"
		return
	fi

	local pid
	pid="$(cat "$pid_file" 2>/dev/null || true)"
	if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
		kill "$pid" >/dev/null 2>&1 || true
		echo "$label stopped"
	else
		echo "$label not running"
	fi
	rm -f "$pid_file"
}

stop_pid_file "$PID_DIR/backend.pid" "Backend"
stop_pid_file "$PID_DIR/frontend.pid" "Frontend"
stop_pid_file "$PID_DIR/pf-prometheus.pid" "Prometheus port-forward"
stop_pid_file "$PID_DIR/pf-loki.pid" "Loki port-forward"
stop_pid_file "$PID_DIR/pf-tempo.pid" "Tempo port-forward"
stop_pid_file "$PID_DIR/pf-grafana.pid" "Grafana port-forward"
