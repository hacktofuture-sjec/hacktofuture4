from __future__ import annotations


class MetricFeatureBuilder:
    @staticmethod
    def build(metrics: dict) -> dict:
        memory = float(metrics.get("memory_percent", 0.0))
        cpu = float(metrics.get("cpu_percent", 0.0))
        restarts = int(metrics.get("restart_count", 0))
        latency_delta = float(metrics.get("latency_delta_ratio", 1.0))

        return {
            "memory_usage_percent": memory,
            "cpu_usage_percent": cpu,
            "restart_count": restarts,
            "latency_delta_ratio": latency_delta,
            "memory_anomaly": memory >= 90,
            "cpu_anomaly": cpu >= 85,
            "restart_burst": restarts >= 3,
            "latency_anomaly": latency_delta >= 2.0,
        }
