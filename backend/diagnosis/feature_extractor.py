from typing import Any


def _value(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def extract_features(snapshot: Any) -> dict[str, Any]:
    """
    Extract engineered features from incident snapshot for diagnosis.
    These features help rule and AI engines understand incident patterns.
    """
    metrics = _value(snapshot, "metrics", {})

    memory_raw = _value(metrics, "memory", _value(metrics, "memory_pct", 0))
    cpu_raw = _value(metrics, "cpu", _value(metrics, "cpu_pct", 0))
    restarts_raw = _value(metrics, "restarts", _value(metrics, "restart_count", 0))
    latency_raw = _value(metrics, "latency_delta", _value(metrics, "latency_delta_x", 0))

    # Memory features
    memory_pct = float(str(memory_raw).rstrip("%") or 0)
    memory_z_score = _compute_z_score(memory_pct, baseline_pct=50.0, stdev=20.0)

    # CPU features
    cpu_pct = float(str(cpu_raw).rstrip("%") or 0)
    cpu_z_score = _compute_z_score(cpu_pct, baseline_pct=40.0, stdev=15.0)

    # Restart features
    restart_count = float(restarts_raw or 0)
    restart_burst = _detect_burst(restart_count, baseline=1, threshold=3)

    # Latency features
    latency_delta = float(str(latency_raw).rstrip("x") or 0)
    latency_anomaly = latency_delta > 2.0

    # Event and log features
    events_str = str(_value(snapshot, "events", _value(snapshot, "event_reason", [])))
    logs_str = str(_value(snapshot, "logs_summary", _value(snapshot, "log_signatures", [])))

    return {
        "memory_usage_percent": memory_pct,
        "memory_z_score": memory_z_score,
        "cpu_usage_percent": cpu_pct,
        "cpu_z_score": cpu_z_score,
        "restart_count": int(restart_count),
        "restart_burst": restart_burst,
        "latency_delta_x": latency_delta,
        "latency_anomaly": latency_anomaly,
        "oom_event_count": events_str.lower().count("oomkilled"),
        "crash_loop_event_count": events_str.lower().count("crashloopbackoff"),
        "image_pull_failure_count": events_str.lower().count("imagepullbackoff"),
        "timeout_log_count": logs_str.lower().count("timeout"),
        "error_log_count": logs_str.lower().count("error"),
        "top_error_signature": _extract_top_signature(_value(snapshot, "logs_summary", _value(snapshot, "log_signatures", []))),
    }


def _compute_z_score(value: float, baseline_pct: float, stdev: float) -> float:
    """Compute Z-score relative to baseline."""
    if stdev == 0:
        return 0.0
    return (value - baseline_pct) / stdev


def _detect_burst(current: float, baseline: float, threshold: int) -> bool:
    """Detect burst: sudden jump >= threshold."""
    return (current - baseline) >= threshold


def _extract_top_signature(logs_summary: list[Any]) -> str:
    """Extract the top-ranked error signature from pre-ordered summaries."""
    if not logs_summary:
        return "none"
    top = logs_summary[0]
    if isinstance(top, dict) and "signature" in top:
        return str(top["signature"])[:100]
    return "unknown"
