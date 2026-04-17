"""
memory.py
---------
Stage 10: Incident Memory Store

Stores each pipeline event as a structured incident record:
  telemetry -> prediction -> action -> outcome

Records are appended to a JSON Lines file for easy querying.
This simulates a "learning system" that remembers past incidents.
"""

import os
import json
from datetime import datetime, timezone

# Path to incident log
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
INCIDENT_LOG = os.path.join(DATA_DIR, "incident_history.jsonl")


def store_incident(telemetry: dict, anomaly_result: dict,
                   classification: dict, rca: dict,
                   decision: dict, safety: dict,
                   verification: dict,
                   service_name: str = "target-service") -> dict:
    """
    Record a complete pipeline incident to the memory store.

    Args:
        All stage outputs from the pipeline run.

    Returns:
        The stored incident record dict.
    """
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": service_name,
        "telemetry": telemetry,
        "anomaly": anomaly_result,
        "classification": {
            "predicted_class": classification.get("predicted_class"),
            "confidence": classification.get("confidence"),
        },
        "root_cause": {
            "reason": rca.get("reason"),
            "severity": rca.get("severity"),
            "signals": rca.get("signals"),
        },
        "decision": {
            "proposed_action": safety.get("original_action"),
            "final_action": safety.get("final_action"),
            "policy_overrides": safety.get("policy_overrides"),
        },
        "verification": {
            "status": verification.get("status"),
            "checks_passed": verification.get("checks_passed"),
        },
    }

    # Ensure data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)

    # Append to JSON Lines file
    with open(INCIDENT_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, default=str) + "\n")

    return record


def get_incident_history(limit: int = 10) -> list[dict]:
    """
    Retrieve recent incidents from the memory store.

    Args:
        limit: maximum number of records to return (most recent first).

    Returns:
        List of incident record dicts.
    """
    if not os.path.exists(INCIDENT_LOG):
        return []

    records = []
    with open(INCIDENT_LOG, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))

    # Return most recent first
    return list(reversed(records[-limit:]))


def get_incident_stats() -> dict:
    """
    Get summary statistics from the incident memory.

    Returns:
        dict with counts by class, action, and outcome.
    """
    history = get_incident_history(limit=1000)

    if not history:
        return {"total_incidents": 0}

    class_counts = {}
    action_counts = {}
    outcome_counts = {}

    for record in history:
        cls = record.get("classification", {}).get("predicted_class", "unknown")
        action = record.get("decision", {}).get("final_action", "unknown")
        status = record.get("verification", {}).get("status", "unknown")

        class_counts[cls] = class_counts.get(cls, 0) + 1
        action_counts[action] = action_counts.get(action, 0) + 1
        outcome_counts[status] = outcome_counts.get(status, 0) + 1

    return {
        "total_incidents": len(history),
        "by_class": class_counts,
        "by_action": action_counts,
        "by_outcome": outcome_counts,
    }
