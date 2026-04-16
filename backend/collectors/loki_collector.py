from typing import Any


class LokiCollector:
    def query_logs(self, logql: str) -> dict[str, Any]:
        # Replace with real Loki HTTP query in implementation phase.
        return {"source": "loki", "query": logql, "signatures": []}
