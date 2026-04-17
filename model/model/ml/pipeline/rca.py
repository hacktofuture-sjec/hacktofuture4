"""
rca.py
------
Stage 6: Root Cause Analysis Correlation Engine

Combines ML prediction with raw telemetry signals to produce a structured
root cause analysis. Uses rule-based heuristics on top of ML output to
identify the most likely root cause and supporting evidence.
"""


# Thresholds for signal-level analysis
THRESHOLDS = {
    "cpu_high": 75,
    "memory_high": 1000,
    "latency_high": 500,
    "error_high": 20,
    "restart_high": 5,
    "rps_high": 500,
    "connections_high": 300,
}


def _identify_signals(telemetry: dict) -> list[str]:
    """Identify which system signals are elevated."""
    signals = []
    if telemetry.get("cpu_percent", 0) > THRESHOLDS["cpu_high"]:
        signals.append("high_cpu")
    if telemetry.get("memory_mb", 0) > THRESHOLDS["memory_high"]:
        signals.append("high_memory")
    if telemetry.get("latency_ms", 0) > THRESHOLDS["latency_high"]:
        signals.append("high_latency")
    if telemetry.get("error_count", 0) > THRESHOLDS["error_high"]:
        signals.append("high_errors")
    if telemetry.get("restart_count", 0) > THRESHOLDS["restart_high"]:
        signals.append("frequent_restarts")
    if telemetry.get("requests_per_sec", 0) > THRESHOLDS["rps_high"]:
        signals.append("high_traffic")
    if telemetry.get("active_connections", 0) > THRESHOLDS["connections_high"]:
        signals.append("connection_saturation")

    # Replica mismatch
    replicas = telemetry.get("replicas", 1)
    available = telemetry.get("available_replicas", 0)
    if available < replicas:
        signals.append("replica_deficit")

    # Unreachable
    if telemetry.get("is_reachable", 1) == 0:
        signals.append("service_unreachable")

    return signals


# Mapping of (predicted_class, signal_pattern) -> root cause explanation
RCA_RULES = {
    "overload": {
        "reason_template": "Resource saturation under high traffic load",
        "detail_map": {
            "high_cpu":    "CPU at {cpu_percent}% exceeds capacity",
            "high_memory": "Memory usage at {memory_mb}MB indicates pressure",
            "high_traffic": "Request rate {requests_per_sec}/s exceeds service capacity",
            "connection_saturation": "{active_connections} active connections approaching limit",
        },
    },
    "crash_loop": {
        "reason_template": "Pod instability with repeated restart cycles",
        "detail_map": {
            "frequent_restarts": "Pod has restarted {restart_count} times",
            "replica_deficit":   "Only {available_replicas}/{replicas} replicas available",
            "service_unreachable": "Service health check failing",
        },
    },
    "latency_issue": {
        "reason_template": "Degraded response times affecting service quality",
        "detail_map": {
            "high_latency": "P99 latency at {latency_ms}ms exceeds SLO",
            "high_memory":  "Memory pressure may be contributing to slow responses",
        },
    },
    "service_error": {
        "reason_template": "Elevated error rates from application layer",
        "detail_map": {
            "high_errors":  "{error_count} errors in observation window",
            "high_latency": "Latency at {latency_ms}ms may indicate upstream failure",
            "service_unreachable": "Service intermittently unreachable",
        },
    },
    "healthy": {
        "reason_template": "All systems operating within normal parameters",
        "detail_map": {},
    },
}


def correlate_root_cause(telemetry: dict, predicted_class: str,
                         is_anomalous: bool, confidence: float,
                         service_name: str = "target-service") -> dict:
    """
    Generate a structured RCA report.

    Args:
        telemetry:       validated telemetry dict
        predicted_class: output from classifier
        is_anomalous:    output from anomaly detector
        confidence:      classifier confidence score
        service_name:    name of the affected service

    Returns:
        Structured RCA dict ready for UI display or API response.
    """
    signals = _identify_signals(telemetry)
    rules = RCA_RULES.get(predicted_class, RCA_RULES["healthy"])

    # Build evidence from matching signals
    evidence = {}
    contributing_factors = []

    for signal in signals:
        if signal in rules["detail_map"]:
            detail = rules["detail_map"][signal].format(**telemetry)
            contributing_factors.append(detail)
        # Always include the raw signal value as evidence
        evidence[signal] = True

    # Add key metrics to evidence
    evidence["anomaly_detected"] = is_anomalous
    evidence["ml_confidence"] = confidence
    evidence["cpu_percent"] = telemetry.get("cpu_percent")
    evidence["memory_mb"] = telemetry.get("memory_mb")
    evidence["latency_ms"] = telemetry.get("latency_ms")
    evidence["restart_count"] = telemetry.get("restart_count")
    evidence["error_count"] = telemetry.get("error_count")

    # Determine severity
    if predicted_class == "healthy":
        severity = "info"
    elif confidence > 0.85 and len(signals) >= 3:
        severity = "critical"
    elif confidence > 0.7:
        severity = "warning"
    else:
        severity = "info"

    return {
        "rootCause": service_name,
        "predicted_class": predicted_class,
        "reason": rules["reason_template"],
        "severity": severity,
        "contributing_factors": contributing_factors,
        "signals": signals,
        "evidence": evidence,
    }
