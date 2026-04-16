#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
PID_DIR="$ROOT_DIR/.run"

graceful_kill_pid() {
	local pid="$1"
	if [ -z "$pid" ] || ! kill -0 "$pid" >/dev/null 2>&1; then
		return
	fi

	kill "$pid" >/dev/null 2>&1 || true
	for _ in 1 2 3 4 5; do
		if ! kill -0 "$pid" >/dev/null 2>&1; then
			return
		fi
		sleep 0.2
	done

	kill -9 "$pid" >/dev/null 2>&1 || true
}

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
		graceful_kill_pid "$pid"
		echo "$label stopped"
	else
		echo "$label not running"
	fi
	rm -f "$pid_file"
}

kill_by_pattern() {
	local pattern="$1"
	pkill -f "$pattern" >/dev/null 2>&1 || true
}

kill_by_port() {
	local port="$1"
	if command -v lsof >/dev/null 2>&1; then
		local pids
		pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
		if [ -n "$pids" ]; then
			kill $pids >/dev/null 2>&1 || true
			sleep 0.2
			for pid in $pids; do
				kill -9 "$pid" >/dev/null 2>&1 || true
			done
		fi
	elif command -v fuser >/dev/null 2>&1; then
		fuser -k "$port"/tcp >/dev/null 2>&1 || true
	fi
}

stop_pid_file "$PID_DIR/backend.pid" "Backend"
stop_pid_file "$PID_DIR/frontend.pid" "Frontend"
stop_pid_file "$PID_DIR/pf-prometheus.pid" "Prometheus port-forward"
stop_pid_file "$PID_DIR/pf-loki.pid" "Loki port-forward"
stop_pid_file "$PID_DIR/pf-tempo.pid" "Tempo port-forward"
stop_pid_file "$PID_DIR/pf-grafana.pid" "Grafana port-forward"

# Fallback cleanup for orphaned processes from reload/restarts.
kill_by_pattern "uvicorn main:app"
kill_by_pattern "uvicorn.*main:app"
kill_by_pattern "next dev"
kill_by_pattern "kubectl port-forward"

# Final guard: ensure common service ports are free.
kill_by_port 8000
kill_by_port 3000
kill_by_port 9090
kill_by_port 3100
kill_by_port 3200
kill_by_port 3300
