"""
classifier.py
--------------
Stage 4 + 5: Failure Classification with Confidence Scoring

Loads the trained RandomForest model and label encoder, predicts the
failure class, and returns prediction probabilities for confidence scoring.

Output:
  - predicted_class:   string label
  - confidence:        float 0-1
  - all_probabilities: dict of class -> probability
"""

import os
import joblib
import pandas as pd

# Feature columns (must match training order)
CLASSIFIER_FEATURES = [
    "cpu_percent", "memory_mb", "latency_ms", "restart_count",
    "error_count", "requests_per_sec", "active_connections",
    "replicas", "available_replicas", "is_reachable",
]

# Paths to saved artifacts
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
CLASSIFIER_PATH = os.path.join(MODEL_DIR, "classifier.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")


def classify_failure(telemetry: dict) -> dict:
    """
    Classify a telemetry snapshot into one of 5 failure classes.

    Args:
        telemetry: validated telemetry dict.

    Returns:
        dict with predicted_class, confidence, and all_probabilities.
    """
    if not os.path.exists(CLASSIFIER_PATH):
        raise FileNotFoundError(
            f"Classifier not found at {CLASSIFIER_PATH}. "
            "Run `python train_model.py` first."
        )

    clf = joblib.load(CLASSIFIER_PATH)
    le = joblib.load(ENCODER_PATH)

    # Build feature vector
    row = {f: telemetry.get(f, 0) for f in CLASSIFIER_FEATURES}
    df = pd.DataFrame([row])[CLASSIFIER_FEATURES]

    # Predict class and probabilities
    pred_encoded = clf.predict(df)[0]
    pred_label = le.inverse_transform([pred_encoded])[0]
    probabilities = clf.predict_proba(df)[0]

    # Build probability map for all classes
    all_probs = {
        label: round(float(prob), 4)
        for label, prob in zip(le.classes_, probabilities)
    }

    # Confidence = probability of the predicted class
    confidence = float(probabilities[pred_encoded])

    return {
        "predicted_class": pred_label,
        "confidence": round(confidence, 4),
        "all_probabilities": all_probs,
    }
