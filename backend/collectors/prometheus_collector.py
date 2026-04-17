from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from config import settings


class PrometheusCollector:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.prometheus_url).rstrip("/")

    async def query_instant(self, promql: str, when: datetime | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"query": promql}
        if when:
            params["time"] = when.timestamp()
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.base_url}/api/v1/query", params=params)
            response.raise_for_status()
            payload = response.json()
        if payload.get("status") != "success":
            return []
        return payload.get("data", {}).get("result", [])

    async def query_range(
        self,
        promql: str,
        start: datetime,
        end: datetime,
        step: str = "15s",
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "query": promql,
            "start": start.timestamp(),
            "end": end.timestamp(),
            "step": step,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.base_url}/api/v1/query_range", params=params)
            response.raise_for_status()
            payload = response.json()
        if payload.get("status") != "success":
            return []
        return payload.get("data", {}).get("result", [])

    @staticmethod
    def extract_scalar(result: list[dict[str, Any]]) -> float | None:
        if not result:
            return None
        return float(result[0]["value"][1])

    async def get_incident_metrics(self, namespace: str, pod: str) -> dict[str, float]:
        memory_pct = await self.query_instant(
            f'(container_memory_usage_bytes{{namespace="{namespace}",pod="{pod}"}} '
            f'/ container_spec_memory_limit_bytes{{namespace="{namespace}",pod="{pod}"}}) * 100'
        )
        cpu_pct = await self.query_instant(
            f'rate(container_cpu_usage_seconds_total{{namespace="{namespace}",pod="{pod}"}}[5m]) * 100'
        )
        restarts = await self.query_instant(
            f'kube_pod_container_status_restarts_total{{namespace="{namespace}",pod="{pod}"}}'
        )
        latency_p95 = await self.query_instant(
            f'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{{namespace="{namespace}"}}[5m]))'
        )
        error_rate = await self.query_instant(
            f'rate(http_requests_total{{namespace="{namespace}",status=~"5.."}}[5m])'
        )
        return {
            "memory_usage_percent": float(self.extract_scalar(memory_pct) or 0.0),
            "cpu_usage_percent": float(self.extract_scalar(cpu_pct) or 0.0),
            "restart_count": float(self.extract_scalar(restarts) or 0.0),
            "latency_p95_seconds": float(self.extract_scalar(latency_p95) or 0.0),
            "error_rate_rps": float(self.extract_scalar(error_rate) or 0.0),
        }

    async def get_baseline_samples(self, namespace: str, pod: str, samples: int = 10) -> list[dict[str, float]]:
        end = datetime.now(timezone.utc)
        start = end - timedelta(minutes=5)
        memory_series = await self.query_range(
            f'(container_memory_usage_bytes{{namespace="{namespace}",pod="{pod}"}} '
            f'/ container_spec_memory_limit_bytes{{namespace="{namespace}",pod="{pod}"}}) * 100',
            start,
            end,
            step="15s",
        )
        cpu_series = await self.query_range(
            f'rate(container_cpu_usage_seconds_total{{namespace="{namespace}",pod="{pod}"}}[5m]) * 100',
            start,
            end,
            step="15s",
        )
        latency_series = await self.query_range(
            f'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{{namespace="{namespace}"}}[5m]))',
            start,
            end,
            step="15s",
        )
        restart_series = await self.query_range(
            f'kube_pod_container_status_restarts_total{{namespace="{namespace}",pod="{pod}"}}',
            start,
            end,
            step="15s",
        )

        samples_out: list[dict[str, float]] = []
        for i in range(samples):
            m_val = 0.0
            c_val = 0.0
            l_val = 0.0
            r_val = 0.0
            if memory_series and memory_series[0].get("values"):
                vals = memory_series[0]["values"]
                m_val = float(vals[min(i, len(vals) - 1)][1])
            if cpu_series and cpu_series[0].get("values"):
                vals = cpu_series[0]["values"]
                c_val = float(vals[min(i, len(vals) - 1)][1])
            if latency_series and latency_series[0].get("values"):
                vals = latency_series[0]["values"]
                l_val = float(vals[min(i, len(vals) - 1)][1])
            if restart_series and restart_series[0].get("values"):
                vals = restart_series[0]["values"]
                r_val = float(vals[min(i, len(vals) - 1)][1])
            samples_out.append(
                {
                    "memory_usage_percent": m_val,
                    "cpu_usage_percent": c_val,
                    "latency_p95_seconds": l_val,
                    "restart_count": r_val,
                    "error_rate_rps": 0.0,
                }
            )
        return samples_out

    async def health(self) -> bool:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{self.base_url}/-/healthy")
        return response.status_code == 200
