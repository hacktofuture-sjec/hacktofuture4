import numpy as np
import pandas as pd
import joblib
import os
from sklearn.ensemble import IsolationForest
from typing import List, Dict, Any, Tuple

MODEL_PATH = os.environ.get("MODEL_PATH", "saved_model/isolation_forest.joblib")

FEATURES = [
    "latency",
    "restartCount",
    "error",
    "crash",
    "overload",
    "reachable",
    "replicas",
]

# Thresholds for severity mapping
SEVERITY_MAP = [
    (0.80, "critical"),
    (0.60, "high"),
    (0.40, "medium"),
    (0.0,  "low"),
]

_model: IsolationForest | None = None


def get_model() -> IsolationForest | None:
    global _model
    return _model


def load_model() -> bool:
    global _model
    if not os.path.exists(MODEL_PATH):
        return False
    try:
        _model = joblib.load(MODEL_PATH)
        return True
    except Exception as e:
        print(f"[ml-service] Failed to load model: {e}")
        return False


def save_model(model: IsolationForest) -> None:
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)


def extract_features(service: Dict[str, Any]) -> List[float]:
    return [
        float(service.get("latency", 0)),
        float(service.get("restartCount", 0)),
        float(service.get("error", False)),
        float(service.get("crash", False)),
        float(service.get("overload", False)),
        float(not service.get("reachable", True)),   # unreachable = 1
        float(service.get("replicas", 1)),
    ]


def _raw_score_to_confidence(raw_score: float) -> float:
    """
    IsolationForest decision_function returns negative scores for anomalies.
    We map this to a 0-1 confidence where 1 = very anomalous.
    """
    # raw_score range is roughly [-0.5, 0.5]; clip and normalise
    clipped = np.clip(raw_score, -0.5, 0.5)
    # flip so lower (more anomalous) → higher confidence
    normalised = 1.0 - (clipped + 0.5)
    return round(float(normalised), 4)


def map_severity(confidence: float) -> str:
    for threshold, label in SEVERITY_MAP:
        if confidence >= threshold:
            return label
    return "low"


def build_reason(service: Dict[str, Any], confidence: float) -> str:
    flags = []
    if service.get("latency", 0) > 1000:
        flags.append("high latency")
    if service.get("restartCount", 0) > 1:
        flags.append("elevated restart count")
    if service.get("crash"):
        flags.append("crash detected")
    if service.get("error"):
        flags.append("error flag active")
    if service.get("overload"):
        flags.append("overload flag active")
    if not service.get("reachable", True):
        flags.append("service unreachable")
    if not flags:
        flags.append("statistical deviation from baseline")
    return ", ".join(f.capitalize() for f in flags) + " detected"


def analyze(services: List[Dict[str, Any]]) -> Dict[str, Any]:
    global _model

    if _model is None:
        loaded = load_model()
        if not loaded:
            # Auto-train on first call if no model exists
            print("[ml-service] No model found — training baseline model now.")
            train_baseline_model()

    feature_matrix = np.array([extract_features(s) for s in services])

    # decision_function: negative = anomaly
    raw_scores = _model.decision_function(feature_matrix)
    predictions = _model.predict(feature_matrix)   # -1 = anomaly, 1 = normal

    scores = []
    for i, svc in enumerate(services):
        confidence = _raw_score_to_confidence(raw_scores[i])
        is_anomaly = predictions[i] == -1
        scores.append({
            "service": svc["service"],
            "anomaly": is_anomaly,
            "score": confidence,
        })

    # Pick the most anomalous service
    anomalous = [s for s in scores if s["anomaly"]]
    any_anomaly = len(anomalous) > 0

    if anomalous:
        top = max(anomalous, key=lambda x: x["score"])
        suspected_idx = next(i for i, s in enumerate(services) if s["service"] == top["service"])
        suspected_service = top["service"]
        top_confidence = top["score"]
        severity = map_severity(top_confidence)
        reason = build_reason(services[suspected_idx], top_confidence)
    else:
        top_score = max(scores, key=lambda x: x["score"])
        suspected_service = None
        top_confidence = top_score["score"]
        severity = "low"
        reason = "No anomalies detected — all services within normal parameters"

    return {
        "success": True,
        "anomaly": any_anomaly,
        "suspectedService": suspected_service,
        "severity": severity,
        "confidence": top_confidence,
        "reason": reason,
        "scores": scores,
    }


def train_baseline_model(
    n_samples: int = 1000,
    contamination: float = 0.05,
    n_estimators: int = 100,
) -> Tuple[IsolationForest, int]:
    """
    Generate synthetic normal-behaviour data and train an IsolationForest.

    Normal baseline characteristics:
      latency       : 50–500 ms
      restartCount  : 0–1
      error         : mostly False
      crash         : mostly False
      overload      : mostly False
      reachable     : mostly True
      replicas      : 1–3
    """
    rng = np.random.default_rng(42)

    latency      = rng.uniform(50, 500, n_samples)
    restart      = rng.integers(0, 2, n_samples).astype(float)
    error        = rng.choice([0.0, 1.0], n_samples, p=[0.95, 0.05])
    crash        = rng.choice([0.0, 1.0], n_samples, p=[0.98, 0.02])
    overload     = rng.choice([0.0, 1.0], n_samples, p=[0.95, 0.05])
    unreachable  = rng.choice([0.0, 1.0], n_samples, p=[0.98, 0.02])
    replicas     = rng.integers(1, 4, n_samples).astype(float)

    X = np.column_stack([latency, restart, error, crash, overload, unreachable, replicas])

    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=42,
    )
    model.fit(X)
    save_model(model)

    global _model
    _model = model

    return model, n_samples
