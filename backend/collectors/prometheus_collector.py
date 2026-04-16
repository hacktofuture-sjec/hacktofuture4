from __future__ import annotations

from datetime import datetime

import httpx

from config import settings


class PrometheusCollector:
    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.prometheus_url).rstrip("/")

    async def query(self, promql: str) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/query",
                    params={"query": promql},
                )
            response.raise_for_status()
            payload = response.json()
            if payload.get("status") != "success":
                return []
            return payload.get("data", {}).get("result", [])
        except Exception:
            return []

    @staticmethod
    def _extract_scalar(result: list[dict]) -> float:
        if not result:
            return 0.0
        try:
            return float(result[0]["value"][1])
        except Exception:
            return 0.0

    async def get_service_metrics(self, namespace: str, deployment: str, pod: str | None = None) -> dict:
        pod_selector = pod or f"{deployment}.*"

        memory_q = (
            f'(container_memory_usage_bytes{{namespace="{namespace}",pod=~"{pod_selector}"}} '
            f'/ container_spec_memory_limit_bytes{{namespace="{namespace}",pod=~"{pod_selector}"}}) * 100'
        )
        cpu_q = f'rate(container_cpu_usage_seconds_total{{namespace="{namespace}",pod=~"{pod_selector}"}}[5m]) * 100'
        restarts_q = f'kube_pod_container_status_restarts_total{{namespace="{namespace}",pod=~"{pod_selector}"}}'
        latency_q = (
            f'histogram_quantile(0.95, '
            f'rate(http_request_duration_seconds_bucket{{namespace="{namespace}"}}[5m]))'
        )

        memory = self._extract_scalar(await self.query(memory_q))
        cpu = self._extract_scalar(await self.query(cpu_q))
        restarts = int(self._extract_scalar(await self.query(restarts_q)))
        latency_p95 = self._extract_scalar(await self.query(latency_q))

        return {
            "namespace": namespace,
            "deployment": deployment,
            "collected_at": datetime.utcnow().isoformat() + "Z",
            "memory_percent": memory,
            "cpu_percent": cpu,
            "restart_count": restarts,
            "latency_p95_seconds": latency_p95,
            "latency_delta_ratio": max(1.0, latency_p95 / 0.75) if latency_p95 else 1.0,
        }
