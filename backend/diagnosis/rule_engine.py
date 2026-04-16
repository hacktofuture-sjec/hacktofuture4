from __future__ import annotations

from models.schemas import IncidentSnapshot


def _metric_int(value: str) -> int:
    return int(value.replace("%", "").strip()) if value else 0


def _latency_x(value: str) -> float:
    return float(value.replace("x", "").strip()) if value else 1.0


FINGERPRINT_CATALOG = [
    {
        "id": "FP-001",
        "name": "memory_exhaustion_oom",
        "conditions": [
            lambda s: any(e.reason == "OOMKilled" for e in s.events),
            lambda s: _metric_int(s.metrics.memory) >= 90,
        ],
        "root_cause": "memory exhaustion: container exceeded memory limit",
        "affected_services": lambda s: [s.service],
        "confidence": 0.95,
    },
    {
        "id": "FP-002",
        "name": "crash_loop_application_error",
        "conditions": [
            lambda s: any(e.reason in {"CrashLoopBackOff", "BackOff"} for e in s.events),
            lambda s: s.metrics.restarts >= 5,
        ],
        "root_cause": "application crash loop: repeated process exit",
        "affected_services": lambda s: [s.service],
        "confidence": 0.90,
    },
    {
        "id": "FP-003",
        "name": "image_pull_failure",
        "conditions": [
            lambda s: any(e.reason in {"ImagePullBackOff", "ErrImagePull"} for e in s.events),
        ],
        "root_cause": "image pull failure: invalid image tag or registry auth",
        "affected_services": lambda s: [s.service],
        "confidence": 0.92,
    },
    {
        "id": "FP-004",
        "name": "infra_resource_saturation",
        "conditions": [lambda s: any(e.reason == "FailedScheduling" for e in s.events)],
        "root_cause": "infrastructure saturation: pods cannot be scheduled",
        "affected_services": lambda s: [s.service],
        "confidence": 0.88,
    },
    {
        "id": "FP-005",
        "name": "db_connection_pool_saturation",
        "conditions": [
            lambda s: _latency_x(s.metrics.latency_delta) >= 2.0,
            lambda s: any(
                ("timeout" in sig.signature.lower()) or ("connection" in sig.signature.lower())
                for sig in s.logs_summary
            ),
        ],
        "root_cause": "database connection pool saturation",
        "affected_services": lambda s: [s.service, "db-primary"],
        "confidence": 0.82,
    },
    {
        "id": "FP-006",
        "name": "cpu_starvation",
        "conditions": [
            lambda s: _metric_int(s.metrics.cpu) >= 90,
            lambda s: not any(e.reason == "OOMKilled" for e in s.events),
        ],
        "root_cause": "cpu starvation: container throttled by CPU limits",
        "affected_services": lambda s: [s.service],
        "confidence": 0.85,
    },
]


def match_fingerprint(snapshot: IncidentSnapshot) -> dict | None:
    matches = []
    for fingerprint in FINGERPRINT_CATALOG:
        try:
            if all(cond(snapshot) for cond in fingerprint["conditions"]):
                matches.append(fingerprint)
        except Exception:
            continue

    if not matches:
        return None
    return max(matches, key=lambda item: item["confidence"])
