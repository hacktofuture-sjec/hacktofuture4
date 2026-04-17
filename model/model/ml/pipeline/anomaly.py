"""
anomaly.py
----------
Stage 3: Anomaly Detection Layer

Uses an IsolationForest model to score incoming telemetry for anomalousness
BEFORE classification. This catches novel failure modes that the classifier
may not have been trained on.

Output:
  - anomaly_score:  float (-1 to 0 = anomalous, 0 to 1 = normal)
  - is_anomalous:   bool
"""

import os
import joblib
import pandas as pd

# Features used by the anomaly model (same base features as classifier)
ANOMALY_FEATURES = [
    "cpu_percent", "memory_mb", "latency_ms", "restart_count",
    "error_count", "requests_per_sec", "active_connections",
    "replicas", "available_replicas", "is_reachable",
]

# Path to saved anomaly model
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
ANOMALY_MODEL_PATH = os.path.join(MODEL_DIR, "anomaly_model.pkl")


def detect_anomaly(telemetry: dict) -> dict:
    """
    Score a telemetry snapshot for anomalousness.

    Args:
        telemetry: validated telemetry dict with all base features.

    Returns:
        dict with:
          - anomaly_score:  raw score from IsolationForest
          - is_anomalous:   True if the model flags it as an outlier
    """
    if not os.path.exists(ANOMALY_MODEL_PATH):
        raise FileNotFoundError(
            f"Anomaly model not found at {ANOMALY_MODEL_PATH}. "
            "Run `python train_anomaly.py` first."
        )

    model = joblib.load(ANOMALY_MODEL_PATH)

    # Build feature vector in correct order
    row = {f: telemetry.get(f, 0) for f in ANOMALY_FEATURES}
    df = pd.DataFrame([row])[ANOMALY_FEATURES]

    # score_samples: higher = more normal, lower = more anomalous
    raw_score = model.score_samples(df)[0]

    # decision_function: negative = anomaly, positive = normal
    decision = model.decision_function(df)[0]

    # predict: 1 = normal, -1 = anomaly
    prediction = model.predict(df)[0]

    return {
        "anomaly_score": round(raw_score, 4),
        "is_anomalous": prediction == -1,
    }
