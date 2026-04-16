from typing import Any, Optional


FINGERPRINT_CATALOG = [
    {
        "id": "FP-001",
        "name": "memory_exhaustion_oom",
        "conditions": [
            lambda s: float(s.get("metrics", {}).get("memory_pct", 0)) >= 90,
            lambda s: "OOMKilled" in str(s.get("events", [])),
        ],
        "confidence_base": 0.95,
        "recommended_fix": "increase memory limit or restart pod",
    },
    {
        "id": "FP-002",
        "name": "crash_loop_application_error",
        "conditions": [
            lambda s: "CrashLoopBackOff" in str(s.get("events", [])),
            lambda s: float(s.get("metrics", {}).get("restart_count", 0)) >= 3,
        ],
        "confidence_base": 0.92,
        "recommended_fix": "review application logs and fix deployment",
    },
    {
        "id": "FP-003",
        "name": "image_pull_failure",
        "conditions": [
            lambda s: "ImagePullBackOff" in str(s.get("events", [])),
        ],
        "confidence_base": 0.90,
        "recommended_fix": "verify container image and registry credentials",
    },
    {
        "id": "FP-004",
        "name": "cpu_starvation",
        "conditions": [
            lambda s: float(s.get("metrics", {}).get("cpu_pct", 0)) >= 90,
            lambda s: float(s.get("metrics", {}).get("memory_pct", 0)) < 80,
        ],
        "confidence_base": 0.85,
        "recommended_fix": "scale up replicas or increase CPU limit",
    },
    {
        "id": "FP-005",
        "name": "db_connection_pool_saturation",
        "conditions": [
            lambda s: float(s.get("metrics", {}).get("latency_delta", 0)) > 2.0,
            lambda s: "timeout" in str(s.get("logs_summary", [])).lower(),
        ],
        "confidence_base": 0.80,
        "recommended_fix": "increase database connection pool size",
    },
]


def _normalize_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Normalize flat monitor snapshots into nested diagnosis shape."""
    if "metrics" in snapshot:
        return snapshot

    return {
        "metrics": {
            "memory_pct": snapshot.get("memory_pct", 0),
            "cpu_pct": snapshot.get("cpu_pct", 0),
            "restart_count": snapshot.get("restart_count", 0),
            "latency_delta": snapshot.get("latency_delta", 0),
        },
        "events": snapshot.get("event_reason", snapshot.get("events", [])),
        "logs_summary": snapshot.get("log_signatures", snapshot.get("logs_summary", [])),
    }


def match_fingerprint(snapshot: dict[str, Any]) -> Optional[dict[str, Any]]:
    """
    Match incident snapshot against fingerprint catalog.
    Returns the best matching fingerprint with confidence score.
    """
    normalized_snapshot = _normalize_snapshot(snapshot)
    matches = []

    for fp in FINGERPRINT_CATALOG:
        # Check if all conditions match
        all_match = True
        for condition in fp["conditions"]:
            try:
                if not condition(normalized_snapshot):
                    all_match = False
                    break
            except (KeyError, ValueError, TypeError):
                all_match = False
                break

        if all_match:
            matches.append(
                {
                    "fingerprint_id": fp["id"],
                    "name": fp["name"],
                    "confidence": fp["confidence_base"],
                    "recommended_fix": fp["recommended_fix"],
                }
            )

    if matches:
        # Return highest confidence match
        return max(matches, key=lambda m: m["confidence"])

    return None
