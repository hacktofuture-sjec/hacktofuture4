from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from config import settings


class TempoCollector:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.tempo_url).rstrip("/")

    @staticmethod
    def should_query(
        latency_delta_x: float,
        timeout_log_count: int,
        cross_service_suspected: bool,
        rule_confidence: float,
        failure_class: str,
    ) -> bool:
        if rule_confidence > 0.85 and failure_class in {"resource_exhaustion", "infra_saturation"}:
            return False
        return (
            latency_delta_x > settings.trace_latency_delta_threshold
            or timeout_log_count > 10
            or cross_service_suspected
        )

    async def get_trace(self, trace_id: str) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.base_url}/api/traces/{trace_id}")
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()

    async def search_traces(self, service: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/api/search",
                params={
                    "service.name": service,
                    "start": int(start.timestamp()),
                    "end": int(end.timestamp()),
                    "limit": 5,
                },
            )
            response.raise_for_status()
            return response.json().get("traces", [])

    def summarize(self, trace: dict[str, Any] | None) -> dict[str, Any] | None:
        if not trace:
            return None
        spans = trace.get("batches", [{}])[0].get("spans", [])
        if not spans:
            return None
        slowest = max(spans, key=lambda span: span.get("duration", 0))
        services = list(
            {
                span.get("process", {}).get("serviceName", "unknown")
                for span in spans
            }
        )
        return {
            "enabled": True,
            "suspected_path": " -> ".join(services),
            "hot_span": slowest.get("operationName", "unknown"),
            "p95_ms": int(slowest.get("duration", 0) / 1000),
        }

    async def health(self) -> bool:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{self.base_url}/ready")
        return response.status_code == 200 and response.text.strip() == "ready"
