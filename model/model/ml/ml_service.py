import os
import joblib
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Load model
# --------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "models", "classifier.pkl")
ENCODER_PATH = os.path.join(BASE_DIR, "models", "label_encoder.pkl")

model = joblib.load(MODEL_PATH)
encoder = joblib.load(ENCODER_PATH)

print("✅ ML Model Loaded Successfully")

# --------------------------------------------------
# Helper: Map ML prediction → action
# --------------------------------------------------
def map_action(label):
    if label == "overload":
        return "SCALE_DEPLOYMENT"
    elif label == "crash_loop":
        return "RESTART_SERVICE"
    elif label == "latency_issue":
        return "INVESTIGATE_LATENCY"
    elif label == "service_error":
        return "CHECK_LOGS"
    return "NONE"

# --------------------------------------------------
# Helper: Confidence → execution mode
# --------------------------------------------------
def execution_mode(confidence):
    if confidence > 0.8:
        return "AUTO"
    elif confidence > 0.5:
        return "REVIEW"
    else:
        return "BLOCKED"

# --------------------------------------------------
# Helper: Explanation generator
# --------------------------------------------------
def generate_explanation(label, data):
    if label == "overload":
        return "High CPU, latency and request rate indicate overload condition"
    elif label == "latency_issue":
        return "High latency observed despite normal resource usage"
    elif label == "service_error":
        return "High error count indicates service instability"
    elif label == "crash_loop":
        return "Frequent restarts indicate crash loop"
    return "System operating normally"

# --------------------------------------------------
# Health check
# --------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

# --------------------------------------------------
# Prediction endpoint
# --------------------------------------------------
@app.post("/predict")
def predict(data: dict):
    try:
        features = [
            data["cpu_percent"],
            data["memory_mb"],
            data["latency_ms"],
            data["restart_count"],
            data["error_count"],
            data["requests_per_sec"],
            data["active_connections"],
            data["replicas"],
            data["available_replicas"],
            data["is_reachable"]
        ]

        X = np.array(features).reshape(1, -1)

        pred = model.predict(X)[0]
        probs = model.predict_proba(X).max()

        label = encoder.inverse_transform([pred])[0]

        action = map_action(label)
        exec_mode = execution_mode(probs)
        explanation = generate_explanation(label, data)

        return {
            "predicted_class": label,
            "confidence_score": float(probs),
            "anomaly_detected": label != "healthy",
            "severity": "high" if probs > 0.8 else "medium" if probs > 0.5 else "low",
            "recommended_action": action,
            "execution_mode": exec_mode,
            "explanation": explanation
        }

    except Exception as e:
        return {"error": str(e)}