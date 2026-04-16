from __future__ import annotations

from datetime import datetime, timedelta, timezone

from kubernetes import client, config


class K8sEventsCollector:
    def __init__(self):
        self._api: client.CoreV1Api | None = None

    def _get_api(self) -> client.CoreV1Api | None:
        if self._api is not None:
            return self._api
        try:
            config.load_kube_config()
            self._api = client.CoreV1Api()
            return self._api
        except Exception:
            return None

    async def get_recent_events(self, namespace: str, deployment: str, minutes: int = 10) -> list[dict]:
        api = self._get_api()
        if api is None:
            return []

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        try:
            events = api.list_namespaced_event(namespace=namespace)
        except Exception:
            return []

        filtered: list[dict] = []
        for event in events.items:
            involved = getattr(event, "involved_object", None)
            pod_name = getattr(involved, "name", "") if involved else ""
            if deployment not in pod_name:
                continue

            last_seen = getattr(event, "last_timestamp", None) or getattr(event, "event_time", None)
            if last_seen and last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            if last_seen and last_seen < cutoff:
                continue

            filtered.append(
                {
                    "reason": event.reason or "Unknown",
                    "message": event.message or "",
                    "count": event.count or 1,
                    "first_seen": event.first_timestamp.isoformat() if event.first_timestamp else None,
                    "last_seen": last_seen.isoformat() if last_seen else None,
                    "pod": pod_name,
                    "namespace": namespace,
                    "type": event.type or "Warning",
                }
            )

        return filtered
