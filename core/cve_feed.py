"""Real-time CVE intelligence feed.

Polls NVD every 60 s for CRITICAL + HIGH CVEs published in the last 24 h.
New CVEs are broadcast via WebSocket so the dashboard shows a live ticker.
Mission orchestrator pulls from `.latest` to inject CVE context into each
recon task, giving the Red crew actual threat intelligence to work with.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

import httpx

_logger = logging.getLogger(__name__)

NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
_SEVERITIES = ("CRITICAL", "HIGH")
POLL_INTERVAL = 60  # seconds


class CVEFeed:
    def __init__(self) -> None:
        self._seen: set[str] = set()
        self._latest: list[dict] = []
        self._running = False
        self._task: asyncio.Task | None = None
        self._callbacks: list[Callable[[list[dict]], Awaitable[None]]] = []
        self._api_key: str = os.environ.get("NVD_API_KEY", "")

    # ── Public API ──────────────────────────────────────────────────────

    def on_new_cves(self, cb: Callable[[list[dict]], Awaitable[None]]) -> None:
        """Register an async callback fired whenever new CVEs are found."""
        self._callbacks.append(cb)

    @property
    def latest(self) -> list[dict]:
        return list(self._latest)

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        _logger.info("[CVEFeed] Started — api_key=%s", bool(self._api_key))

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()

    # ── Poll loop ───────────────────────────────────────────────────────

    async def _poll_loop(self) -> None:
        # Fetch immediately on startup, then every POLL_INTERVAL seconds
        for sev in _SEVERITIES:
            await self._fetch(sev)
        while self._running:
            await asyncio.sleep(POLL_INTERVAL)
            for sev in _SEVERITIES:
                await self._fetch(sev)

    async def _fetch(self, severity: str) -> None:
        now = datetime.now(timezone.utc)
        params = {
            "pubStartDate": (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%S.000"),
            "pubEndDate": now.strftime("%Y-%m-%dT%H:%M:%S.000"),
            "cvssV3Severity": severity,
            "resultsPerPage": 20,
        }
        headers: dict[str, str] = {"User-Agent": "htf-arena-cve-feed/1.0"}
        if self._api_key:
            headers["apiKey"] = self._api_key

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.get(NVD_URL, params=params, headers=headers)

            if r.status_code == 429:
                _logger.warning("[CVEFeed] NVD rate-limited — sleeping 15s")
                await asyncio.sleep(15)
                return
            if r.status_code != 200:
                _logger.warning("[CVEFeed] NVD %s returned %s", severity, r.status_code)
                return

            vulns = r.json().get("vulnerabilities", []) or []
            new_entries: list[dict] = []

            for v in vulns:
                cve_block = v.get("cve", {})
                cve_id = cve_block.get("id", "")
                if cve_id and cve_id not in self._seen:
                    self._seen.add(cve_id)
                    entry = self._extract(cve_block, severity)
                    new_entries.append(entry)
                    self._latest.insert(0, entry)

            self._latest = self._latest[:100]  # keep last 100

            if new_entries:
                _logger.info("[CVEFeed] %d new %s CVEs: %s",
                             len(new_entries), severity,
                             ", ".join(e["id"] for e in new_entries[:3]))
                for cb in self._callbacks:
                    try:
                        await cb(new_entries)
                    except Exception as exc:
                        _logger.warning("[CVEFeed] callback error: %s", exc)

        except Exception as exc:
            _logger.warning("[CVEFeed] fetch error (%s): %s", severity, exc)

    # ── NVD extraction ──────────────────────────────────────────────────

    def _extract(self, cve: dict, severity: str) -> dict:
        cve_id = cve.get("id", "UNKNOWN")

        description = ""
        for d in cve.get("descriptions", []) or []:
            if d.get("lang") == "en":
                description = (d.get("value") or "")[:220]
                break

        score = 0.0
        metrics = cve.get("metrics", {}) or {}
        for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
            entries = metrics.get(key) or []
            if entries:
                data = entries[0].get("cvssData") or {}
                score = float(data.get("baseScore") or 0.0)
                break

        products: list[str] = []
        for cfg in cve.get("configurations", []) or []:
            for node in cfg.get("nodes", []) or []:
                for match in node.get("cpeMatch", []) or []:
                    criteria = match.get("criteria", "")
                    parts = criteria.split(":")
                    if len(parts) >= 5:
                        products.append(f"{parts[3]}:{parts[4]}")
                    if len(products) >= 4:
                        break

        return {
            "id": cve_id,
            "description": description,
            "cvss_score": score,
            "severity": severity,
            "published": cve.get("published", ""),
            "affected_products": products[:4],
        }


# Module-level singleton used by orchestrator + API routes
cve_feed = CVEFeed()
