"""
validation.py
-------------
Stage 1: Data Validation Layer

Sanitises raw telemetry before it enters the ML pipeline.
  - Fills missing values with safe defaults
  - Clips values to realistic ranges
  - Ensures correct types
  - Returns a clean, validated dict
"""

import copy

# Realistic bounds for each telemetry feature
FEATURE_BOUNDS = {
    "cpu_percent":        {"min": 0.0,   "max": 100.0,  "default": 0.0},
    "memory_mb":          {"min": 0.0,   "max": 64000.0, "default": 0.0},
    "latency_ms":         {"min": 0.0,   "max": 30000.0, "default": 0.0},
    "restart_count":      {"min": 0,     "max": 500,     "default": 0},
    "error_count":        {"min": 0,     "max": 10000,   "default": 0},
    "requests_per_sec":   {"min": 0.0,   "max": 50000.0, "default": 0.0},
    "active_connections": {"min": 0,     "max": 50000,   "default": 0},
    "replicas":           {"min": 0,     "max": 100,     "default": 1},
    "available_replicas": {"min": 0,     "max": 100,     "default": 0},
    "is_reachable":       {"min": 0,     "max": 1,       "default": 1},
}

# Features that must be integers
INT_FEATURES = {"restart_count", "error_count", "active_connections",
                "replicas", "available_replicas", "is_reachable"}


def validate_telemetry(raw: dict) -> dict:
    """
    Validate and sanitise a single telemetry snapshot.

    Args:
        raw: dict of raw telemetry values (may have missing/bad values).

    Returns:
        Cleaned dict with all features present, typed, and clipped.
    """
    cleaned = {}
    warnings = []

    for feature, bounds in FEATURE_BOUNDS.items():
        value = raw.get(feature)

        # Handle missing values
        if value is None:
            value = bounds["default"]
            warnings.append(f"  [FILL] {feature} was missing, set to {value}")

        # Cast to correct type
        try:
            value = int(value) if feature in INT_FEATURES else float(value)
        except (ValueError, TypeError):
            value = bounds["default"]
            warnings.append(f"  [CAST] {feature} had bad type, set to {value}")

        # Clip to valid range
        original = value
        value = max(bounds["min"], min(bounds["max"], value))
        if value != original:
            warnings.append(f"  [CLIP] {feature}: {original} -> {value}")

        cleaned[feature] = value

    # Logical constraint: available_replicas <= replicas
    if cleaned["available_replicas"] > cleaned["replicas"]:
        cleaned["available_replicas"] = cleaned["replicas"]
        warnings.append("  [FIX] available_replicas clamped to replicas")

    return {
        "validated_telemetry": cleaned,
        "is_valid": len(warnings) == 0,
        "warnings": warnings,
    }
