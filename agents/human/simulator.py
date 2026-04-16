"""
Human User Simulator — Phase 6 / False-Positive Stress Test

Generates realistic benign HTTP traffic against the 6 live Docker services
using the same IP pool and request patterns a real user would produce.

Purpose:
  False-positive detection — Blue's ML model should classify this traffic
  as "normal" (CLEAN). Any alert fired on this traffic is a false positive
  and is counted in metrics["false_positives"].

Traffic model:
  - Each simulated user has a stable IP (192.168.200.x range) to distinguish
    from Red's attack IPs.
  - Requests are drawn from a profile that matches each service's legitimate
    API surface (login, read, health check, browse).
  - Requests are randomised over a THINK_TIME window to mimic human pacing.
  - No SQLi, no path traversal, no JWT abuse — all traffic is genuinely clean.

Integration:
  BattleOrchestrator instantiates HumanSimulator and calls
  simulator.run_turn() concurrently with the Red and Blue turns.
  Logs land in the real Docker services, so Blue reads them through the
  normal _collect_logs() pipeline — making false positive testing authentic.
"""
import asyncio
import json
import logging
import random
import time
from typing import Optional

import httpx

log = logging.getLogger("human_sim")

# ──────────────────────────────────────────────────────────────────────────────
# Simulated user pool — IPs distinct from Red's attack IPs
# ──────────────────────────────────────────────────────────────────────────────
USER_IPS = [f"192.168.200.{i}" for i in range(10, 20)]

# ──────────────────────────────────────────────────────────────────────────────
# Benign request profiles per service
# Each entry: (method, path, body_factory or None, description)
# ──────────────────────────────────────────────────────────────────────────────
def _PROFILES():
    return {
        "flask-sqli": [
            ("GET",  "/health",                  None,                     "health check"),
            ("POST", "/login",                   lambda: {"username": random.choice(["alice","bob","charlie"]),
                                                           "password": "hunter2"},  "login attempt"),
            ("GET",  "/products",                None,                     "browse products"),
            ("GET",  f"/products?page={random.randint(1,10)}", None,       "paginate products"),
        ],
        "node-pathtraversal": [
            ("GET",  "/health",                  None,                     "health check"),
            ("GET",  "/files/readme.txt",        None,                     "read readme"),
            ("GET",  "/files/logo.png",          None,                     "read asset"),
            ("GET",  "/files/index.html",        None,                     "read index"),
        ],
        "jwt-auth": [
            ("GET",  "/health",                  None,                     "health check"),
            ("POST", "/login",                   lambda: {"user": "admin", "password": "secret"}, "login"),
        ],
        "redis-noauth": [
            ("GET",  "/health",                  None,                     "health check"),
            ("GET",  "/ping",                    None,                     "ping redis"),
        ],
        "nginx-misconfig": [
            ("GET",  "/health",                  None,                     "health check"),
            ("GET",  "/",                        None,                     "home page"),
            ("GET",  "/static/style.css",        None,                     "load css"),
        ],
        "postgres-weak": [
            ("GET",  "/health",                  None,                     "health check"),
        ],
    }

# Internal service hostnames and ports (Docker network)
SERVICE_ENDPOINTS = {
    "flask-sqli":         "http://flask-sqli:5000",
    "node-pathtraversal": "http://node-pathtraversal:4000",
    "jwt-auth":           "http://jwt-auth:3002",
    "redis-noauth":       "http://redis-noauth:6380",
    "nginx-misconfig":    "http://nginx-misconfig:80",
    "postgres-weak":      "http://postgres-weak:5433",
}

# Timeout for human requests — benign traffic is not latency-sensitive
REQUEST_TIMEOUT = 2.0

# Min/max delay between requests from a single simulated user (seconds)
THINK_TIME = (0.2, 0.8)


class HumanSimulator:
    """
    Generates benign HTTP traffic against all live services each turn.

    Call `await simulator.run_turn(n_requests=3)` from the orchestrator
    during the Red turn sleep window (the 1.5s log-flush delay) or
    concurrently with it.
    """

    def __init__(self):
        self._session_count = 0
        self._fp_this_session = 0   # false positives caught by caller

    # ────────────────────────────────────────────────────────────────────────
    async def run_turn(self, n_requests: int = 4) -> list[dict]:
        """
        Fire n_requests benign HTTP requests across random services.

        Returns a list of request-result dicts for logging/broadcasting.
        """
        tasks = [self._send_one_request() for _ in range(n_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        out = []
        for r in results:
            if isinstance(r, dict):
                out.append(r)
            else:
                log.debug(f"[Human] request skipped: {r}")
        self._session_count += len(out)
        return out

    # ────────────────────────────────────────────────────────────────────────
    async def _send_one_request(self) -> Optional[dict]:
        """Pick a random service + benign request and fire it."""
        await asyncio.sleep(random.uniform(*THINK_TIME))

        profiles = _PROFILES()
        service  = random.choice(list(profiles.keys()))
        entry    = random.choice(profiles[service])
        method, path, body_fn, desc = entry

        base_url = SERVICE_ENDPOINTS.get(service)
        if not base_url:
            return None

        ip      = random.choice(USER_IPS)
        url     = base_url + path
        headers = {
            "X-Forwarded-For": ip,
            "User-Agent": random.choice([
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36",
                "Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0",
            ]),
        }
        body = body_fn() if callable(body_fn) else None

        t0 = time.time()
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                if method == "POST":
                    resp = await client.post(url, json=body, headers=headers)
                else:
                    resp = await client.get(url, headers=headers)
            status = resp.status_code
        except Exception as e:
            status = 0
            log.debug(f"[Human] {service} {method} {path} → unreachable: {e}")

        elapsed = round(time.time() - t0, 3)
        result = {
            "service": service,
            "method":  method,
            "path":    path,
            "desc":    desc,
            "src_ip":  ip,
            "status":  status,
            "elapsed": elapsed,
        }
        log.debug(f"[Human] {service} {method} {path} ({desc}) → {status} in {elapsed}s")
        return result

    # ────────────────────────────────────────────────────────────────────────
    @property
    def total_requests(self) -> int:
        return self._session_count

    def reset(self):
        """Call on battle reset to wipe counters."""
        self._session_count = 0
        self._fp_this_session = 0
