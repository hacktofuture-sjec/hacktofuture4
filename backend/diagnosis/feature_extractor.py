from typing import Any
import statistics


def extract_features(snapshot: dict[str, Any]) -> dict[str, Any]:
    """
    Extract engineered features from incident snapshot for diagnosis.
    These features help rule and AI engines understand incident patterns.
    """
    metrics = snapshot.get("metrics", {})

    # Memory features
    memory_pct = float(metrics.get("memory_pct", 0))
    memory_z_score = _compute_z_score(memory_pct, baseline_pct=50.0, stdev=20.0)

    # CPU features
    cpu_pct = float(metrics.get("cpu_pct", 0))
    cpu_z_score = _compute_z_score(cpu_pct, baseline_pct=40.0, stdev=15.0)

    # Restart features
    restart_count = float(metrics.get("restart_count", 0))
    restart_burst = _detect_burst(restart_count, baseline=1, threshold=3)

    # Latency features
    latency_delta = float(metrics.get("latency_delta", 0))
    latency_anomaly = latency_delta > 2.0

    # Event and log features
    events_str = str(snapshot.get("events", []))
    logs_str = str(snapshot.get("logs_summary", []))

    return {
        "memory_pct": memory_pct,
        "memory_z_score": memory_z_score,
        "cpu_pct": cpu_pct,
        "cpu_z_score": cpu_z_score,
        "restart_count": int(restart_count),
        "restart_burst_detected": restart_burst,
        "latency_delta": latency_delta,
        "latency_anomaly": latency_anomaly,
        "oom_event_count": events_str.lower().count("oomkilled"),
        "crash_loop_event_count": events_str.lower().count("crashloopbackoff"),
        "image_pull_failure_count": events_str.lower().count("imagepullbackoff"),
        "timeout_log_count": logs_str.lower().count("timeout"),
        "error_log_count": logs_str.lower().count("error"),
        "top_error_signature": _extract_top_signature(snapshot.get("logs_summary", [])),
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
    """Extract the most frequent error signature."""
    if not logs_summary:
        return "none"
    if isinstance(logs_summary, list) and len(logs_summary) > 0:
        top = logs_summary[0]
        if isinstance(top, dict) and "signature" in top:
            return str(top["signature"])[:100]
    return "unknown"
