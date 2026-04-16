from typing import Any


class K8sEventsCollector:
    def list_recent_events(self, namespace: str = "default") -> dict[str, Any]:
        # Replace with Kubernetes API integration in implementation phase.
        return {"source": "k8s-events", "namespace": namespace, "events": []}
