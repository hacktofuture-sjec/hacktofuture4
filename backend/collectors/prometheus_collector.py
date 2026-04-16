from typing import Any


class PrometheusCollector:
    def query_instant(self, promql: str) -> dict[str, Any]:
        # Replace with real Prometheus HTTP query in implementation phase.
        return {"source": "prometheus", "query": promql, "value": 0.0}
