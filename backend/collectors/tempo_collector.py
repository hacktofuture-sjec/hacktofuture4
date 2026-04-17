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

    @staticmethod
    def _extract_spans(trace: dict[str, Any]) -> list[dict[str, Any]]:
        spans: list[dict[str, Any]] = []

        # OTLP trace shape from Tempo /api/traces/{trace_id}
        for resource_span in trace.get("resourceSpans", []):
            for scope_span in resource_span.get("scopeSpans", []):
                spans.extend(scope_span.get("spans", []))

        # Backward-compatible shape for older/local payloads.
        for batch in trace.get("batches", []):
            spans.extend(batch.get("spans", []))
            for scope_span in batch.get("scopeSpans", []):
                spans.extend(scope_span.get("spans", []))

        return spans

    @staticmethod
    def _span_duration_ns(span: dict[str, Any]) -> int:
        if "durationNanos" in span:
            return int(span.get("durationNanos") or 0)

        start_ns = int(span.get("startTimeUnixNano") or 0)
        end_ns = int(span.get("endTimeUnixNano") or 0)
        if start_ns and end_ns and end_ns >= start_ns:
            return end_ns - start_ns

        # Fallback for non-OTLP test payloads that may already provide duration.
        return int(span.get("duration") or 0)

    def summarize(self, trace: dict[str, Any] | None) -> dict[str, Any] | None:
        if not trace:
            return None
        spans = self._extract_spans(trace)
        if not spans:
            return None
        slowest = max(spans, key=self._span_duration_ns)
        services = list(
            {
                span.get("process", {}).get("serviceName", "unknown")
                for span in spans
            }
        )
        p95_ms = int(self._span_duration_ns(slowest) / 1_000_000)
        return {
            "enabled": True,
            "suspected_path": " -> ".join(services),
            "hot_span": slowest.get("operationName", "unknown"),
            "p95_ms": p95_ms,
        }

    async def health(self) -> bool:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{self.base_url}/ready")
        return response.status_code == 200 and response.text.strip() == "ready"
