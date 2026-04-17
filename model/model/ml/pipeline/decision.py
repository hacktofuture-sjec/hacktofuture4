"""
decision.py
-----------
Stage 7: Decision Engine (ML + Rule Hybrid)

Maps ML prediction + confidence score to a concrete remediation action.
Uses a combination of classifier output and rule-based logic.

Actions:
  SCALE_DEPLOYMENT  - increase replica count
  RESTART_POD       - kill and restart failing pods
  DRAIN_NODE        - drain traffic from problematic node
  ALERT_ONLY        - notify SRE team, no auto-action
  NO_ACTION         - system healthy, nothing to do
"""

# Confidence threshold below which we don't auto-remediate
CONFIDENCE_THRESHOLD = 0.70

# Decision matrix: (predicted_class, confidence_level) -> action
# confidence_level: "high" >= 0.85, "medium" >= 0.70, "low" < 0.70
DECISION_MATRIX = {
    "overload": {
        "high":   {"action": "SCALE_DEPLOYMENT",  "reason": "High-confidence overload detected, scaling up"},
        "medium": {"action": "SCALE_DEPLOYMENT",  "reason": "Probable overload, attempting scale-up"},
        "low":    {"action": "ALERT_ONLY",         "reason": "Possible overload but low confidence, alerting SRE"},
    },
    "crash_loop": {
        "high":   {"action": "RESTART_POD",        "reason": "CrashLoopBackOff confirmed, restarting pod"},
        "medium": {"action": "RESTART_POD",        "reason": "Likely crash loop, attempting pod restart"},
        "low":    {"action": "ALERT_ONLY",         "reason": "Possible crash loop but uncertain, alerting SRE"},
    },
    "latency_issue": {
        "high":   {"action": "SCALE_DEPLOYMENT",  "reason": "Sustained latency degradation, scaling to distribute load"},
        "medium": {"action": "ALERT_ONLY",         "reason": "Latency elevated, monitoring before action"},
        "low":    {"action": "ALERT_ONLY",         "reason": "Minor latency fluctuation, alerting for review"},
    },
    "service_error": {
        "high":   {"action": "RESTART_POD",        "reason": "High error rate from service, restarting to recover"},
        "medium": {"action": "ALERT_ONLY",         "reason": "Elevated errors, alerting SRE for investigation"},
        "low":    {"action": "ALERT_ONLY",         "reason": "Some errors detected, monitoring"},
    },
    "healthy": {
        "high":   {"action": "NO_ACTION",          "reason": "System healthy, no action needed"},
        "medium": {"action": "NO_ACTION",          "reason": "System appears healthy"},
        "low":    {"action": "ALERT_ONLY",         "reason": "Low confidence on healthy state, monitoring"},
    },
}


def _confidence_level(confidence: float) -> str:
    """Map confidence score to a categorical level."""
    if confidence >= 0.85:
        return "high"
    elif confidence >= CONFIDENCE_THRESHOLD:
        return "medium"
    else:
        return "low"


def decide_action(predicted_class: str, confidence: float,
                  is_anomalous: bool) -> dict:
    """
    Determine the remediation action based on ML output.

    Args:
        predicted_class: failure class from classifier
        confidence:      prediction confidence (0-1)
        is_anomalous:    whether anomaly detector flagged this

    Returns:
        dict with action, reason, confidence_level, auto_remediate flag.
    """
    level = _confidence_level(confidence)

    # Look up in decision matrix
    class_decisions = DECISION_MATRIX.get(predicted_class, DECISION_MATRIX["healthy"])
    decision = class_decisions.get(level, {"action": "ALERT_ONLY", "reason": "Unknown state"})

    # If anomaly detected but classifier says healthy, escalate to alert
    if is_anomalous and predicted_class == "healthy":
        decision = {
            "action": "ALERT_ONLY",
            "reason": "Anomaly detected despite healthy classification, alerting for review",
        }

    # Determine if this should be auto-executed
    auto_remediate = (
        decision["action"] not in ("NO_ACTION", "ALERT_ONLY")
        and confidence >= CONFIDENCE_THRESHOLD
    )

    return {
        "action": decision["action"],
        "reason": decision["reason"],
        "confidence_level": level,
        "auto_remediate": auto_remediate,
    }
