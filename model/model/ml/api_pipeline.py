"""
api_pipeline.py
---------------
JSON API entrypoint for the ML pipeline.

Reads JSON input from stdin containing:
  - telemetry_window: list of telemetry readings
  - service_name: target service name
  - verbose: boolean (default false)

Outputs complete pipeline result as JSON to stdout.

Usage:
    echo '{"telemetry_window": [...], "service_name": "service"}' | python api_pipeline.py
"""

import json
import sys
import traceback
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from pipeline.validation import validate_telemetry
from pipeline.feature_engineering import build_temporal_features
from pipeline.anomaly import detect_anomaly
from pipeline.classifier import classify_failure
from pipeline.rca import correlate_root_cause
from pipeline.decision import decide_action
from pipeline.safety import apply_safety_policies


def run_pipeline_api(telemetry_window=None, service_name="target-service", verbose=False):
    """
    Execute the full ML pipeline on a telemetry window.
    
    Args:
        telemetry_window: list of telemetry dicts (oldest first)
        service_name: name of the service being analyzed
        verbose: whether to print debug info to stderr
    
    Returns:
        dict with complete pipeline result
    """
    if not telemetry_window:
        raise ValueError("telemetry_window is required and must be non-empty")
    
    result = {
        "success": True,
        "service": service_name,
        "stages": {}
    }

    try:
        # Stage 1: Validation
        validated_window = []
        for reading in telemetry_window:
            v = validate_telemetry(reading)
            validated_window.append(v["validated_telemetry"])
        
        result["stages"]["validation"] = {
            "readings_validated": len(validated_window),
            "status": "success"
        }

        # Stage 2: Feature Engineering
        enriched = build_temporal_features(validated_window)
        trend_features = {
            "cpu_trend": enriched.get("cpu_trend", 0),
            "latency_trend": enriched.get("latency_trend", 0),
            "restart_growth_rate": enriched.get("restart_growth_rate", 0),
            "error_rate_trend": enriched.get("error_rate_trend", 0),
            "memory_trend": enriched.get("memory_trend", 0),
        }
        
        result["stages"]["feature_engineering"] = {
            "window_size": len(validated_window),
            "trends": trend_features,
            "status": "success"
        }

        current_telemetry = validated_window[-1]

        # Stage 3: Anomaly Detection
        anomaly_result = detect_anomaly(current_telemetry)
        result["stages"]["anomaly"] = {
            "is_anomalous": anomaly_result["is_anomalous"],
            "anomaly_score": anomaly_result["anomaly_score"],
            "status": "success"
        }

        # Stage 4: Failure Classification
        classification = classify_failure(current_telemetry)
        result["stages"]["classification"] = {
            "predicted_class": classification["predicted_class"],
            "confidence": classification["confidence"],
            "all_probabilities": classification["all_probabilities"],
            "status": "success"
        }

        # Stage 5: Root Cause Analysis
        rca = correlate_root_cause(
            telemetry=current_telemetry,
            predicted_class=classification["predicted_class"],
            is_anomalous=anomaly_result["is_anomalous"],
            confidence=classification["confidence"],
            service_name=service_name,
        )
        result["stages"]["rca"] = {
            "predicted_class": classification["predicted_class"],
            "severity": rca["severity"],
            "reason": rca["reason"],
            "contributing_factors": rca.get("contributing_factors", []),
            "signals": rca.get("signals", []),
            "status": "success"
        }

        # Stage 6: Decision Engine
        decision = decide_action(
            predicted_class=classification["predicted_class"],
            confidence=classification["confidence"],
            is_anomalous=anomaly_result["is_anomalous"],
        )
        result["stages"]["decision"] = {
            "action": decision["action"],
            "reason": decision["reason"],
            "confidence_level": decision.get("confidence_level", "unknown"),
            "auto_remediate": decision.get("auto_remediate", False),
            "status": "success"
        }

        # Stage 7: Safety Policies
        safety = apply_safety_policies(
            decision=decision,
            telemetry=current_telemetry,
            service_name=service_name,
        )
        result["stages"]["safety"] = {
            "final_action": safety["final_action"],
            "safe_to_execute": safety["safe_to_execute"],
            "policy_overrides": safety.get("policy_overrides", []),
            "status": "success"
        }

        # Consolidate results for easy consumption
        result["ml_insights"] = {
            "anomaly_detected": anomaly_result["is_anomalous"],
            "anomaly_score": anomaly_result["anomaly_score"],
            "predicted_incident_type": classification["predicted_class"],
            "confidence": classification["confidence"],
            "confidence_level": decision.get("confidence_level", "unknown"),
            "predicted_severity": rca["severity"],
            "recommended_action": safety["final_action"],
            "recommended_reason": decision["reason"],
            "is_safe_to_execute": safety["safe_to_execute"],
            "contributing_signals": rca.get("signals", []),
            "contributing_factors": rca.get("contributing_factors", []),
            "class_probabilities": classification["all_probabilities"],
        }

        # Add telemetry summary
        result["telemetry_summary"] = {
            "current": current_telemetry,
            "trends": trend_features,
            "window_size": len(validated_window),
        }

    except Exception as e:
        result["success"] = False
        result["error"] = str(e)
        result["error_type"] = type(e).__name__
        if verbose:
            traceback.print_exc(file=sys.stderr)

    return result


def main():
    """Read JSON from stdin, run pipeline, output JSON to stdout."""
    try:
        # Read JSON from stdin
        input_json = sys.stdin.read()
        if not input_json.strip():
            raise ValueError("No input provided")
        
        input_data = json.loads(input_json)
        
        # Extract parameters
        telemetry_window = input_data.get("telemetry_window", [])
        service_name = input_data.get("service_name", "target-service")
        verbose = input_data.get("verbose", False)
        
        # Run pipeline
        result = run_pipeline_api(
            telemetry_window=telemetry_window,
            service_name=service_name,
            verbose=verbose
        )
        
        # Output result as JSON
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        error_result = {
            "success": False,
            "error": f"JSON parse error: {str(e)}",
            "error_type": "JSONDecodeError"
        }
        print(json.dumps(error_result))
        sys.exit(1)
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
