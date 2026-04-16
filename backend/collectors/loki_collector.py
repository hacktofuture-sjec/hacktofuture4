from __future__ import annotations

import re
from collections import Counter
from datetime import datetime

import httpx

from config import settings


class LokiCollector:
    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.loki_url).rstrip("/")

    async def get_log_lines(self, namespace: str, app: str, window_minutes: int = 10, limit: int = 1000) -> list[str]:
        end_ns = int(datetime.utcnow().timestamp() * 1e9)
        start_ns = end_ns - (window_minutes * 60 * int(1e9))

        query = f'{{namespace="{namespace}", app="{app}"}} |~ "(?i)(error|warn|fatal|exception|timeout|oom)"'
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/loki/api/v1/query_range",
                    params={
                        "query": query,
                        "start": start_ns,
                        "end": end_ns,
                        "limit": limit,
                        "direction": "backward",
                    },
                )
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        lines: list[str] = []
        for stream in payload.get("data", {}).get("result", []):
            for _, message in stream.get("values", []):
                lines.append(message)
        return lines

    def extract_top_signatures(self, lines: list[str], top_n: int) -> list[dict]:
        normalized: list[str] = []
        for line in lines:
            clean = re.sub(r"\\b[0-9a-f]{8,}\\b", "<id>", line)
            clean = re.sub(r"\\d{4}-\\d{2}-\\d{2}T\\S+", "<ts>", clean)
            clean = re.sub(r"\\b\\d+\\b", "<N>", clean)
            clean = clean.strip()[:200]
            if clean:
                normalized.append(clean)

        counts = Counter(normalized)
        return [{"signature": sig, "count": count} for sig, count in counts.most_common(top_n)]

    async def get_top_signatures(self, namespace: str, app: str, window_minutes: int, top_n: int) -> list[dict]:
        lines = await self.get_log_lines(namespace=namespace, app=app, window_minutes=window_minutes)
        if not lines:
            return []
        return self.extract_top_signatures(lines, top_n=top_n)
