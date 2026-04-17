#!/usr/bin/env python3
"""
T3PS2 sample app producing real metrics and structured logs.
"""

from __future__ import annotations

import http.server
import json
import os
import threading
import time
from datetime import datetime, timezone

SERVICE_NAME = os.environ.get("SERVICE_NAME", "demo-app")
PORT = int(os.environ.get("PORT", "8080"))

request_count = 0
error_count = 0
start_time = time.time()
counter_lock = threading.Lock()


def run_cpu_load(duration_seconds: int = 5) -> None:
    deadline = time.time() + duration_seconds
    while time.time() < deadline:
        _ = sum(i * i for i in range(10000))


def log(level: str, message: str, **kwargs) -> None:
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": SERVICE_NAME,
        "message": message,
        **kwargs,
    }
    print(json.dumps(record), flush=True)


def metrics_output() -> str:
    uptime = time.time() - start_time
    with open("/proc/self/status", "r", encoding="utf-8") as file:
        status = file.read()
    mem_kib = int(status.split("VmRSS:")[1].split("\n")[0].strip().split()[0])
    mem_bytes = mem_kib * 1024

    return f"""# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{{service=\"{SERVICE_NAME}\"}} {request_count}

# HELP http_errors_total Total HTTP errors
# TYPE http_errors_total counter
http_errors_total{{service=\"{SERVICE_NAME}\"}} {error_count}

# HELP process_uptime_seconds Process uptime
# TYPE process_uptime_seconds gauge
process_uptime_seconds{{service=\"{SERVICE_NAME}\"}} {uptime:.1f}

# HELP process_resident_memory_bytes Resident memory
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes{{service=\"{SERVICE_NAME}\"}} {mem_bytes}
"""


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def do_GET(self) -> None:
        global request_count, error_count
        with counter_lock:
            request_count += 1

        if self.path == "/health":
            self._respond(200, b"ok")
            log("info", "health check", path="/health", status=200)
            return

        if self.path == "/metrics":
            body = metrics_output().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4")
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/load":
            log("warn", "CPU load test triggered", duration_seconds=5)
            threading.Thread(target=run_cpu_load, args=(5,), daemon=True).start()
            self._respond(200, b"load complete")
            return

        if self.path == "/":
            self._respond(200, f"service={SERVICE_NAME}".encode("utf-8"))
            log("info", "root hit", path="/", status=200)
            return

        with counter_lock:
            error_count += 1
        self._respond(404, b"not found")
        log("error", "route not found", path=self.path, status=404)

    def _respond(self, status: int, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def background_logger() -> None:
    while True:
        time.sleep(15)
        log("info", "heartbeat", uptime_seconds=round(time.time() - start_time, 1))


if __name__ == "__main__":
    log("info", "starting", port=PORT)
    thread = threading.Thread(target=background_logger, daemon=True)
    thread.start()
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()
