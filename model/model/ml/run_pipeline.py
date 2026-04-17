"""
run_pipeline.py
---------------
Orchestrates the full multi-stage ML pipeline for self-healing Kubernetes.

Pipeline stages (executed in order):
  1. Validation          - sanitise raw telemetry
  2. Feature Engineering - compute trends from sliding window
  3. Anomaly Detection   - IsolationForest scoring
  4. Classification      - RandomForest failure prediction
  5. RCA Correlation     - root cause analysis
  6. Decision Engine     - map to remediation action
  7. Safety Policies     - apply guardrails
  8. Verification        - post-heal outcome check
  9. Incident Memory     - store event for learning

Usage:
    python run_pipeline.py
"""

import json
import sys
import os

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from pipeline.validation import validate_telemetry
from pipeline.feature_engineering import build_temporal_features
from pipeline.anomaly import detect_anomaly
from pipeline.classifier import classify_failure
from pipeline.rca import correlate_root_cause
from pipeline.decision import decide_action
from pipeline.safety import apply_safety_policies
from pipeline.verification import verify_healing
from pipeline.memory import store_incident, get_incident_stats


def run_pipeline(telemetry_window: list[dict],
                 service_name: str = "target-service",
                 verbose: bool = True) -> dict:
    """
    Execute the full ML pipeline on a telemetry window.

    Args:
        telemetry_window: list of 1-5 telemetry dicts (oldest first).
                          The last entry is the "current" reading.
        service_name:     name of the Kubernetes service.
        verbose:          if True, print progress to stdout.

    Returns:
        Complete pipeline result dict.
    """
    result = {"service": service_name}

    # -- Stage 1: Validation ---------------------------------------------------
    if verbose:
        print("\n[1/9] Validation")
    validated_window = []
    for reading in telemetry_window:
        v = validate_telemetry(reading)
        validated_window.append(v["validated_telemetry"])
        if v["warnings"] and verbose:
            for w in v["warnings"]:
                print(f"  {w}")
    if verbose and all(validate_telemetry(r)["is_valid"] for r in telemetry_window):
        print("  All readings valid")
    result["validation"] = {"readings_validated": len(validated_window)}

    # -- Stage 2: Feature Engineering ------------------------------------------
    if verbose:
        print("\n[2/9] Feature Engineering")
    enriched = build_temporal_features(validated_window)
    trend_features = {
        "cpu_trend": enriched.get("cpu_trend", 0),
        "latency_trend": enriched.get("latency_trend", 0),
        "restart_growth_rate": enriched.get("restart_growth_rate", 0),
        "error_rate_trend": enriched.get("error_rate_trend", 0),
        "memory_trend": enriched.get("memory_trend", 0),
    }
    if verbose:
        print(f"  Window size: {len(validated_window)} readings")
        for k, v in trend_features.items():
            direction = "increasing" if v > 0.05 else "decreasing" if v < -0.05 else "stable"
            print(f"  {k}: {v:+.4f} ({direction})")
    result["trends"] = trend_features

    # Use the latest validated reading (with base features only) for ML models
    current_telemetry = validated_window[-1]

    # -- Stage 3: Anomaly Detection --------------------------------------------
    if verbose:
        print("\n[3/9] Anomaly Detection")
    anomaly_result = detect_anomaly(current_telemetry)
    if verbose:
        status = "ANOMALY DETECTED" if anomaly_result["is_anomalous"] else "Normal"
        print(f"  Score: {anomaly_result['anomaly_score']:.4f}")
        print(f"  Status: {status}")
    result["anomaly"] = anomaly_result

    # -- Stage 4+5: Classification + Confidence --------------------------------
    if verbose:
        print("\n[4/9] Failure Classification")
    classification = classify_failure(current_telemetry)
    if verbose:
        print(f"  Predicted: {classification['predicted_class']}")
        print(f"  Confidence: {classification['confidence']:.2%}")
        print(f"  Probabilities: {classification['all_probabilities']}")
    result["classification"] = classification

    # -- Stage 6: RCA Correlation ----------------------------------------------
    if verbose:
        print("\n[5/9] Root Cause Analysis")
    rca = correlate_root_cause(
        telemetry=current_telemetry,
        predicted_class=classification["predicted_class"],
        is_anomalous=anomaly_result["is_anomalous"],
        confidence=classification["confidence"],
        service_name=service_name,
    )
    if verbose:
        print(f"  Severity: {rca['severity']}")
        print(f"  Reason: {rca['reason']}")
        if rca["contributing_factors"]:
            print(f"  Factors:")
            for f in rca["contributing_factors"]:
                print(f"    - {f}")
        print(f"  Signals: {rca['signals']}")
    result["rca"] = rca

    # -- Stage 7: Decision Engine ----------------------------------------------
    if verbose:
        print("\n[6/9] Decision Engine")
    decision = decide_action(
        predicted_class=classification["predicted_class"],
        confidence=classification["confidence"],
        is_anomalous=anomaly_result["is_anomalous"],
    )
    if verbose:
        print(f"  Action: {decision['action']}")
        print(f"  Reason: {decision['reason']}")
        print(f"  Auto-remediate: {decision['auto_remediate']}")
    result["decision"] = decision

    # -- Stage 8: Safety Policies ----------------------------------------------
    if verbose:
        print("\n[7/9] Safety Policies")
    safety = apply_safety_policies(
        decision=decision,
        telemetry=current_telemetry,
        service_name=service_name,
    )
    if verbose:
        if safety["policy_overrides"]:
            for override in safety["policy_overrides"]:
                print(f"  [OVERRIDE] {override}")
        else:
            print("  No policy overrides")
        print(f"  Final action: {safety['final_action']}")
        print(f"  Safe to execute: {safety['safe_to_execute']}")
    result["safety"] = safety

    # -- Stage 9: Post-Heal Verification ---------------------------------------
    if verbose:
        print("\n[8/9] Post-Heal Verification")
    verification = verify_healing(
        telemetry_before=current_telemetry,
        action=safety["final_action"],
    )
    if verbose:
        print(f"  Status: {verification['status']}")
        if verification.get("checks_passed"):
            print(f"  Checks passed: {verification['checks_passed']}")
        if verification.get("checks"):
            for check, passed in verification["checks"].items():
                icon = "[PASS]" if passed else "[FAIL]"
                print(f"    {icon} {check}")
    result["verification"] = {
        "status": verification["status"],
        "checks_passed": verification.get("checks_passed"),
        "checks": verification.get("checks", {}),
    }

    # -- Stage 10: Incident Memory ---------------------------------------------
    if verbose:
        print("\n[9/9] Incident Memory")
    record = store_incident(
        telemetry=current_telemetry,
        anomaly_result=anomaly_result,
        classification=classification,
        rca=rca,
        decision=decision,
        safety=safety,
        verification=verification,
        service_name=service_name,
    )
    if verbose:
        print(f"  Incident recorded at {record['timestamp']}")

    result["timestamp"] = record["timestamp"]
    return result


# ==============================================================================
# Demo scenarios
# ==============================================================================

DEMO_SCENARIOS = {
    "overload": {
        "name": "Overloaded API Gateway",
        "service": "api-gateway",
        "window": [
            {"cpu_percent": 65, "memory_mb": 900, "latency_ms": 400, "restart_count": 0,
             "error_count": 15, "requests_per_sec": 600, "active_connections": 250,
             "replicas": 3, "available_replicas": 3, "is_reachable": 1},
            {"cpu_percent": 78, "memory_mb": 1100, "latency_ms": 800, "restart_count": 1,
             "error_count": 30, "requests_per_sec": 900, "active_connections": 400,
             "replicas": 3, "available_replicas": 3, "is_reachable": 1},
            {"cpu_percent": 92, "memory_mb": 1600, "latency_ms": 1800, "restart_count": 2,
             "error_count": 65, "requests_per_sec": 1400, "active_connections": 750,
             "replicas": 3, "available_replicas": 3, "is_reachable": 1},
        ],
    },
    "crash_loop": {
        "name": "Crash-looping Payment Service",
        "service": "payment-service",
        "window": [
            {"cpu_percent": 35, "memory_mb": 400, "latency_ms": 200, "restart_count": 5,
             "error_count": 10, "requests_per_sec": 80, "active_connections": 30,
             "replicas": 4, "available_replicas": 3, "is_reachable": 1},
            {"cpu_percent": 50, "memory_mb": 550, "latency_ms": 500, "restart_count": 12,
             "error_count": 25, "requests_per_sec": 40, "active_connections": 15,
             "replicas": 4, "available_replicas": 2, "is_reachable": 1},
            {"cpu_percent": 60, "memory_mb": 600, "latency_ms": 900, "restart_count": 22,
             "error_count": 45, "requests_per_sec": 20, "active_connections": 8,
             "replicas": 4, "available_replicas": 1, "is_reachable": 0},
        ],
    },
    "healthy": {
        "name": "Stable User Service",
        "service": "user-service",
        "window": [
            {"cpu_percent": 20, "memory_mb": 280, "latency_ms": 30, "restart_count": 0,
             "error_count": 1, "requests_per_sec": 150, "active_connections": 50,
             "replicas": 3, "available_replicas": 3, "is_reachable": 1},
            {"cpu_percent": 22, "memory_mb": 290, "latency_ms": 35, "restart_count": 0,
             "error_count": 0, "requests_per_sec": 145, "active_connections": 48,
             "replicas": 3, "available_replicas": 3, "is_reachable": 1},
            {"cpu_percent": 21, "memory_mb": 285, "latency_ms": 32, "restart_count": 0,
             "error_count": 2, "requests_per_sec": 155, "active_connections": 52,
             "replicas": 3, "available_replicas": 3, "is_reachable": 1},
        ],
    },
}


def main():
    """Run the pipeline on all demo scenarios."""
    print("=" * 70)
    print("  SELF-HEALING ML PIPELINE - Demo Run")
    print("=" * 70)

    results = []

    for scenario_key, scenario in DEMO_SCENARIOS.items():
        print(f"\n{'='*70}")
        print(f"  SCENARIO: {scenario['name']}")
        print(f"  Service:  {scenario['service']}")
        print(f"{'='*70}")

        result = run_pipeline(
            telemetry_window=scenario["window"],
            service_name=scenario["service"],
            verbose=True,
        )
        results.append(result)

        # Print compact summary
        print(f"\n  --- SUMMARY ---")
        print(f"  Anomaly:       {'YES' if result['anomaly']['is_anomalous'] else 'no'}")
        print(f"  Class:         {result['classification']['predicted_class']}")
        print(f"  Confidence:    {result['classification']['confidence']:.2%}")
        print(f"  Severity:      {result['rca']['severity']}")
        print(f"  Final Action:  {result['safety']['final_action']}")
        print(f"  Verification:  {result['verification']['status']}")

    # Print incident stats
    print(f"\n{'='*70}")
    print("  INCIDENT MEMORY STATS")
    print(f"{'='*70}")
    stats = get_incident_stats()
    print(f"  Total incidents: {stats.get('total_incidents', 0)}")
    if stats.get("by_class"):
        print(f"  By class:  {stats['by_class']}")
    if stats.get("by_action"):
        print(f"  By action: {stats['by_action']}")
    if stats.get("by_outcome"):
        print(f"  By outcome: {stats['by_outcome']}")

    print(f"\n{'='*70}")
    print("  Pipeline run complete!")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()
