from __future__ import annotations

from datetime import datetime, timedelta, timezone

try:
    from kubernetes import client, config
except ImportError:  # pragma: no cover - exercised in minimal local/test environments
    client = None
    config = None

from config import settings


HIGH_SIGNAL_REASONS = {
    "OOMKilled",
    "CrashLoopBackOff",
    "BackOff",
    "ImagePullBackOff",
    "ErrImagePull",
    "FailedScheduling",
    "Evicted",
    "Killing",
    "Unhealthy",
}


class K8sEventsCollector:
    def __init__(self) -> None:
        self.v1 = None
        if client is None or config is None:
            return

        config.load_kube_config(config_file=settings.kubeconfig)
        self.v1 = client.CoreV1Api()

    def _event_to_dict(self, event, namespace: str, pod_name: str) -> dict[str, str | int]:
        first_seen = event.first_timestamp
        last_seen = event.last_timestamp or event.event_time
        return {
            "reason": event.reason or "Unknown",
            "message": event.message or "",
            "count": int(event.count or 1),
            "first_seen": first_seen.isoformat() if first_seen else None,
            "last_seen": last_seen.isoformat() if last_seen else None,
            "pod": pod_name,
            "namespace": namespace,
            "type": event.type or "Warning",
        }

    def get_pod_events(self, namespace: str, pod_name: str, window_minutes: int = 10) -> list[dict[str, str | int]]:
        if self.v1 is None:
            return []

        events = self.v1.list_namespaced_event(
            namespace=namespace,
            field_selector=f"involvedObject.name={pod_name}",
        )
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        out: list[dict[str, str | int]] = []
        for event in events.items:
            last = event.last_timestamp or event.event_time
            if last and last >= cutoff:
                out.append(self._event_to_dict(event, namespace, pod_name))
        return out

    def get_deployment_events(
        self,
        namespace: str,
        deployment: str,
        window_minutes: int = 10,
    ) -> list[dict[str, str | int]]:
        if self.v1 is None:
            return []

        pods = self.v1.list_namespaced_pod(namespace=namespace, label_selector=f"app={deployment}")
        pod_names: set[str] = set()
        replica_sets: set[str] = set()
        for pod in pods.items:
            pod_name = str(pod.metadata.name or "")
            if pod_name:
                pod_names.add(pod_name)
            for owner in pod.metadata.owner_references or []:
                if str(owner.kind or "") == "ReplicaSet" and owner.name:
                    replica_sets.add(str(owner.name))

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        all_events: list[dict[str, str | int]] = []
        events = self.v1.list_namespaced_event(namespace=namespace)

        for event in events.items:
            involved = event.involved_object
            name = str(involved.name or "")
            kind = str(involved.kind or "")
            if not name:
                continue

            if not (
                (kind == "Pod" and name in pod_names)
                or (kind == "ReplicaSet" and name in replica_sets)
                or (kind == "Deployment" and name == deployment)
            ):
                continue

            last = event.last_timestamp or event.event_time or event.first_timestamp
            if last:
                try:
                    if last.tzinfo is None:
                        last = last.replace(tzinfo=timezone.utc)
                    if last < cutoff:
                        continue
                except Exception:
                    pass

            pod_name = name if kind == "Pod" else (next(iter(pod_names)) if pod_names else f"{deployment}-unknown")
            all_events.append(self._event_to_dict(event, namespace, pod_name))

        all_events.sort(key=lambda item: str(item.get("last_seen") or item.get("first_seen") or ""), reverse=True)
        return all_events

    @staticmethod
    def extract_high_signal_reasons(events: list[dict[str, str | int]]) -> list[str]:
        reasons = [str(e.get("reason", "")) for e in events]
        return [reason for reason in reasons if reason in HIGH_SIGNAL_REASONS]
