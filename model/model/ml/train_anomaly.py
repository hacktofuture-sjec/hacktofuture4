"""
train_anomaly.py
-----------------
Trains an IsolationForest anomaly detection model on the synthetic
telemetry dataset. Uses ALL classes to learn the normal data manifold,
with a contamination parameter to flag outliers.

Usage:
    python train_anomaly.py
"""

import os
import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest

# -- Paths ---------------------------------------------------------------------
BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "data", "telemetry_dataset.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "anomaly_model.pkl")

# -- Features (same as classifier) --------------------------------------------
FEATURES = [
    "cpu_percent", "memory_mb", "latency_ms", "restart_count",
    "error_count", "requests_per_sec", "active_connections",
    "replicas", "available_replicas", "is_reachable",
]

# -- Hyper-parameters ----------------------------------------------------------
CONTAMINATION = 0.15   # ~15% of data treated as anomalous
N_ESTIMATORS = 100
RANDOM_STATE = 42


def train_anomaly_model():
    """Train and save the IsolationForest anomaly model."""

    if not os.path.exists(DATA_PATH):
        print(f"[ERROR] Dataset not found at {DATA_PATH}")
        print("    Run `python generate_dataset.py` first.")
        return

    df = pd.read_csv(DATA_PATH)
    print(f"[INFO] Loaded {len(df)} rows from {DATA_PATH}")

    X = df[FEATURES]

    # Train IsolationForest
    model = IsolationForest(
        n_estimators=N_ESTIMATORS,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X)
    print("[OK] IsolationForest trained.")

    # Quick stats on training data
    predictions = model.predict(X)
    n_anomalies = (predictions == -1).sum()
    n_normal = (predictions == 1).sum()
    print(f"[INFO] Training data: {n_normal} normal, {n_anomalies} anomalies")

    # Show anomaly breakdown by class
    df["_anomaly"] = predictions
    print("\n    Anomaly distribution by class:")
    for label in sorted(df["label"].unique()):
        subset = df[df["label"] == label]
        anomalies = (subset["_anomaly"] == -1).sum()
        print(f"      {label:20s} : {anomalies}/{len(subset)} flagged")

    # Save model
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"\n[SAVED] Anomaly model -> {MODEL_PATH}")
    print("[DONE] Anomaly model training complete!")


if __name__ == "__main__":
    train_anomaly_model()
