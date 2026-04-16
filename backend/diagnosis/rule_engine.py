from types import SimpleNamespace
from typing import Any, Optional


def _value(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _event_reason(event: Any) -> str:
    if isinstance(event, dict):
        return str(event.get("reason", ""))
    return str(getattr(event, "reason", ""))


def _signature_text(signature: Any) -> str:
    if isinstance(signature, dict):
        return str(signature.get("signature", ""))
    return str(getattr(signature, "signature", ""))


def _normalize_snapshot(snapshot: Any) -> SimpleNamespace:
    """Normalize legacy and Pydantic snapshots into a condition-friendly object."""
    metrics = _value(snapshot, "metrics", {})
    if isinstance(metrics, dict):
        metrics_ns = SimpleNamespace(
            memory=str(metrics.get("memory", metrics.get("memory_pct", "0%"))),
            cpu=str(metrics.get("cpu", metrics.get("cpu_pct", "0%"))),
            restarts=int(metrics.get("restarts", metrics.get("restart_count", 0))),
            latency_delta=str(metrics.get("latency_delta", metrics.get("latency_delta_x", "1.0x"))),
        )
    else:
        metrics_ns = SimpleNamespace(
            memory=str(_value(metrics, "memory", "0%")),
            cpu=str(_value(metrics, "cpu", "0%")),
            restarts=int(_value(metrics, "restarts", _value(metrics, "restart_count", 0))),
            latency_delta=str(_value(metrics, "latency_delta", _value(metrics, "latency_delta_x", "1.0x"))),
        )

    events = _value(snapshot, "events", _value(snapshot, "event_reason", [])) or []
    logs_summary = _value(snapshot, "logs_summary", _value(snapshot, "log_signatures", [])) or []
    service = _value(snapshot, "service", "unknown")
    scope = _value(snapshot, "scope", {}) or {}
    return SimpleNamespace(
        metrics=metrics_ns,
        events=events,
        logs_summary=logs_summary,
        service=service,
        scope=scope,
    )


FINGERPRINT_CATALOG = [
    {
        "id": "FP-001",
        "name": "memory_exhaustion_oom",
        "conditions": [
            lambda s: int(str(s.metrics.memory).rstrip("%") or 0) >= 90,
            lambda s: any(_event_reason(event) == "OOMKilled" for event in s.events),
        ],
        "root_cause": "memory exhaustion: container exceeded memory limit",
        "affected_services": lambda s: [s.service],
        "confidence_base": 0.95,
        "recommended_fix": "increase memory limit or restart pod",
    },
    {
        "id": "FP-002",
        "name": "crash_loop_application_error",
        "conditions": [
            lambda s: any(_event_reason(event) in {"CrashLoopBackOff", "BackOff"} for event in s.events),
            lambda s: int(getattr(s.metrics, "restarts", 0)) >= 3,
        ],
        "root_cause": "application crash loop: repeated process exit due to code or config error",
        "affected_services": lambda s: [s.service],
        "confidence_base": 0.92,
        "recommended_fix": "review application logs and fix deployment",
    },
    {
        "id": "FP-003",
        "name": "image_pull_failure",
        "conditions": [
            lambda s: any(_event_reason(event) in {"ImagePullBackOff", "ErrImagePull"} for event in s.events),
        ],
        "root_cause": "image pull failure: incorrect image tag or missing registry credentials",
        "affected_services": lambda s: [s.service],
        "confidence_base": 0.90,
        "recommended_fix": "verify container image and registry credentials",
    },
    {
        "id": "FP-004",
        "name": "cpu_starvation",
        "conditions": [
            lambda s: int(str(s.metrics.cpu).rstrip("%") or 0) >= 90,
            lambda s: int(str(s.metrics.memory).rstrip("%") or 0) < 80,
        ],
        "root_cause": "CPU starvation: container throttled due to CPU limit",
        "affected_services": lambda s: [s.service],
        "confidence_base": 0.85,
        "recommended_fix": "scale up replicas or increase CPU limit",
    },
    {
        "id": "FP-005",
        "name": "db_connection_pool_saturation",
        "conditions": [
            lambda s: float(str(s.metrics.latency_delta).rstrip("x") or 0) > 2.0,
            lambda s: any(
                "timeout" in _signature_text(signature).lower()
                or "connection" in _signature_text(signature).lower()
                for signature in s.logs_summary
            ),
        ],
        "root_cause": "database connection pool saturation: requests queuing behind exhausted pool",
        "affected_services": lambda s: [s.service, "db-primary"],
        "confidence_base": 0.80,
        "recommended_fix": "increase database connection pool size",
    },
]


def match_fingerprint(snapshot: Any) -> Optional[dict[str, Any]]:
    """
    Match incident snapshot against fingerprint catalog.
    Returns the best matching fingerprint with confidence score.
    """
    normalized_snapshot = _normalize_snapshot(snapshot)
    matches = []

    for fp in FINGERPRINT_CATALOG:
        all_match = True
        for condition in fp["conditions"]:
            try:
                if not condition(normalized_snapshot):
                    all_match = False
                    break
            except (KeyError, ValueError, TypeError, AttributeError):
                all_match = False
                break

        if all_match:
            matches.append(
                {
                    "fingerprint_id": fp["id"],
                    "name": fp["name"],
                    "confidence": fp["confidence_base"],
                    "root_cause": fp["root_cause"],
                    "affected_services": fp["affected_services"],
                    "recommended_fix": fp["recommended_fix"],
                }
            )

    if matches:
        return max(matches, key=lambda m: m["confidence"])

    return None
