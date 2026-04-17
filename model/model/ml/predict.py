"""
predict.py
----------
Loads the saved failure classifier and label encoder, runs inference
on a sample telemetry snapshot, and prints the predicted class.

Usage:
    python predict.py
"""

import os
import pandas as pd
import joblib

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "models", "failure_classifier.pkl")
ENCODER_PATH = os.path.join(BASE_DIR, "models", "label_encoder.pkl")

# ── Feature columns (must match training order) ─────────────────────────────
FEATURE_COLS = [
    "cpu_percent",
    "memory_mb",
    "latency_ms",
    "restart_count",
    "error_count",
    "requests_per_sec",
    "active_connections",
    "replicas",
    "available_replicas",
    "is_reachable",
]

# ── Example telemetry samples ────────────────────────────────────────────────
# Swap these out or add your own to test different scenarios.

SAMPLE_HEALTHY = {
    "cpu_percent": 22.0,
    "memory_mb": 310.0,
    "latency_ms": 35.0,
    "restart_count": 0,
    "error_count": 1,
    "requests_per_sec": 120.0,
    "active_connections": 45,
    "replicas": 3,
    "available_replicas": 3,
    "is_reachable": 1,
}

SAMPLE_OVERLOAD = {
    "cpu_percent": 95.0,
    "memory_mb": 1800.0,
    "latency_ms": 2200.0,
    "restart_count": 3,
    "error_count": 75,
    "requests_per_sec": 1500.0,
    "active_connections": 800,
    "replicas": 2,
    "available_replicas": 2,
    "is_reachable": 1,
}

SAMPLE_CRASH_LOOP = {
    "cpu_percent": 55.0,
    "memory_mb": 450.0,
    "latency_ms": 800.0,
    "restart_count": 25,
    "error_count": 40,
    "requests_per_sec": 30.0,
    "active_connections": 12,
    "replicas": 4,
    "available_replicas": 1,
    "is_reachable": 0,
}


def predict(sample: dict) -> str:
    """
    Predict the failure class for a single telemetry snapshot.

    Args:
        sample: dict with keys matching FEATURE_COLS.

    Returns:
        Human-readable class label string.
    """
    # Validate required keys
    missing = [k for k in FEATURE_COLS if k not in sample]
    if missing:
        raise ValueError(f"Missing features in sample: {missing}")

    # Load artifacts
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run `python train_model.py` first."
        )
    clf = joblib.load(MODEL_PATH)
    le = joblib.load(ENCODER_PATH)

    # Build DataFrame in correct feature order
    df = pd.DataFrame([sample])[FEATURE_COLS]

    # Predict
    pred_encoded = clf.predict(df)[0]
    pred_label = le.inverse_transform([pred_encoded])[0]

    # Confidence (probability of predicted class)
    proba = clf.predict_proba(df)[0]
    confidence = proba[pred_encoded]

    return pred_label, confidence


def main():
    """Run predictions on all built-in sample snapshots."""
    samples = {
        "Healthy Service": SAMPLE_HEALTHY,
        "Overloaded Service": SAMPLE_OVERLOAD,
        "Crash-Looping Pod": SAMPLE_CRASH_LOOP,
    }

    print("=" * 60)
    print("  Failure Classifier - Inference")
    print("=" * 60)

    for name, sample in samples.items():
        label, confidence = predict(sample)
        print(f"\n  >> {name}")
        print(f"      Predicted class : {label}")
        print(f"      Confidence      : {confidence:.2%}")

    print(f"\n{'='*60}")
    print("  [OK] Done.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
