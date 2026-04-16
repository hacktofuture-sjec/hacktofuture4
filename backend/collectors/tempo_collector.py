from __future__ import annotations

import httpx

from config import settings


class TempoCollector:
    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.tempo_url).rstrip("/")

    @staticmethod
    def should_query(latency_delta_x: float, timeout_log_count: int, cross_service_suspected: bool) -> bool:
        return latency_delta_x > settings.trace_latency_threshold_x or timeout_log_count > 10 or cross_service_suspected

    async def get_trace_summary(self, service: str) -> dict | None:
        # Lightweight placeholder: most setups do not have a direct service->trace lookup API.
        # We keep this deterministic and safe until trace IDs are propagated from logs.
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/ready")
            response.raise_for_status()
        except Exception:
            return None

        return {
            "enabled": True,
            "suspected_path": f"edge-gateway -> {service} -> db-primary",
            "hot_span": f"{service}.db.query",
            "p95_ms": 1500,
        }
