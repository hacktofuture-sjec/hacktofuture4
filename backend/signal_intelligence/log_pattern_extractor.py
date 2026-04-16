from __future__ import annotations

from collectors.loki_collector import LokiCollector


class LogPatternExtractor:
    @staticmethod
    async def extract(namespace: str, service: str, window_minutes: int, top_n: int) -> list[dict]:
        collector = LokiCollector()
        return await collector.get_top_signatures(
            namespace=namespace,
            app=service,
            window_minutes=window_minutes,
            top_n=top_n,
        )
