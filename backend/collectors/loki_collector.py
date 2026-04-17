from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone

import httpx

from config import settings


class LokiCollector:
    NOISE_SIGNATURE_PATTERNS = (
        "health check",
        "heartbeat",
        "ready",
        "liveness probe",
        "readiness probe",
    )

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.loki_url).rstrip("/")

    async def get_log_lines(
        self,
        namespace: str,
        service: str,
        since_minutes: int | None = None,
        limit: int = 1000,
    ) -> list[str]:
        minutes = since_minutes or settings.log_query_window_minutes
        end_ns = int(datetime.now(timezone.utc).timestamp() * 1e9)
        start_ns = end_ns - (minutes * 60 * int(1e9))
        strict_query = f'{{namespace="{namespace}", app="{service}"}} |~ "(?i)(error|warn|fatal|exception|timeout|kill|oom|imagepull|back-off)"'
        relaxed_query = f'{{namespace="{namespace}", app="{service}"}}'

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{self.base_url}/loki/api/v1/query_range",
                params={
                    "query": strict_query,
                    "start": start_ns,
                    "end": end_ns,
                    "limit": limit,
                    "direction": "backward",
                },
            )
            response.raise_for_status()
            payload = response.json()

        lines: list[str] = []
        for stream in payload.get("data", {}).get("result", []):
            for _, message in stream.get("values", []):
                try:
                    parsed = json.loads(message)
                    lines.append(parsed.get("message", message))
                except Exception:
                    lines.append(message)

        if lines:
            return lines

        # Fallback: return recent logs even if they do not match strict error patterns.
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{self.base_url}/loki/api/v1/query_range",
                params={
                    "query": relaxed_query,
                    "start": start_ns,
                    "end": end_ns,
                    "limit": min(limit, 200),
                    "direction": "backward",
                },
            )
            response.raise_for_status()
            payload = response.json()

        for stream in payload.get("data", {}).get("result", []):
            for _, message in stream.get("values", []):
                try:
                    parsed = json.loads(message)
                    lines.append(parsed.get("message", message))
                except Exception:
                    lines.append(message)
        return lines

    def extract_top_signatures(self, lines: list[str], top_n: int | None = None) -> list[dict[str, int | str]]:
        limit = top_n or settings.log_top_signatures
        normalized: list[str] = []
        for line in lines:
            norm = re.sub(r"\b[0-9a-f]{8,}\b", "<id>", line)
            norm = re.sub(r"\d{4}-\d{2}-\d{2}T\S+", "<ts>", norm)
            norm = re.sub(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", "<ip>", norm)
            norm = re.sub(r"\b\d+\b", "<N>", norm)
            norm = re.sub(r"[\w\.-]+@[\w\.-]+", "<email>", norm)
            cleaned = norm[:200].strip()
            if not cleaned:
                continue
            lowered = cleaned.lower()
            if any(pattern in lowered for pattern in self.NOISE_SIGNATURE_PATTERNS):
                continue
            normalized.append(cleaned)

        counts = Counter(normalized)
        return [
            {"signature": signature, "count": count}
            for signature, count in counts.most_common(limit)
            if signature
        ]

    async def get_log_signatures(self, namespace: str, service: str) -> list[dict[str, int | str]]:
        lines = await self.get_log_lines(namespace, service)
        return self.extract_top_signatures(lines, top_n=settings.log_top_signatures)

    async def health(self) -> bool:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{self.base_url}/ready")
        return response.status_code == 200 and response.text.strip() == "ready"
