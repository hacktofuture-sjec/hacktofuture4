from __future__ import annotations

from models.schemas import IncidentSnapshot


def extract_features(snapshot: IncidentSnapshot) -> dict:
    return {
        "memory_usage_percent": int(snapshot.metrics.memory.replace("%", "") or 0),
        "cpu_usage_percent": int(snapshot.metrics.cpu.replace("%", "") or 0),
        "restart_count": snapshot.metrics.restarts,
        "latency_delta_x": float(snapshot.metrics.latency_delta.replace("x", "") or 1.0),
        "oom_event_count": sum(1 for event in snapshot.events if event.reason == "OOMKilled"),
        "crashloop_event_count": sum(1 for event in snapshot.events if event.reason == "CrashLoopBackOff"),
        "backoff_event_count": sum(1 for event in snapshot.events if event.reason == "BackOff"),
        "imagepull_event_count": sum(1 for event in snapshot.events if "ImagePull" in event.reason),
        "top_error_signature": snapshot.logs_summary[0].signature if snapshot.logs_summary else "",
        "log_signature_count": len(snapshot.logs_summary),
        "trace_hot_span": snapshot.trace_summary.hot_span if snapshot.trace_summary else None,
        "trace_p95_ms": snapshot.trace_summary.p95_ms if snapshot.trace_summary else None,
        "failure_class": snapshot.failure_class.value,
        "monitor_confidence": snapshot.monitor_confidence,
    }
