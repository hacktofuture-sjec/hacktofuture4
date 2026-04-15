"""
app.py — Nova Chat ML Anomaly-Detection Service

Endpoints:
  GET  /health           — liveness probe
  POST /ml/analyze       — run anomaly detection on telemetry
  POST /ml/train         — retrain baseline model
  GET  /ml/model-info    — model metadata
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    TelemetryPayload,
    AnalyzeResponse,
    TrainResponse,
    HealthResponse,
    ModelInfoResponse,
)
import model as ml


# ---------------------------------------------------------------------------
# Startup: load model (or train if none exists)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    loaded = ml.load_model()
    if not loaded:
        print("[ml-service] No saved model found — training baseline now …")
        ml.train_baseline_model()
        print("[ml-service] Baseline model trained and saved.")
    else:
        print(f"[ml-service] Model loaded from {ml.MODEL_PATH}")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Nova Chat ML Anomaly-Detection Service",
    description="IsolationForest-based anomaly detection for SolutionSync / Nova Chat",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health():
    return {"status": "healthy", "service": "ml-service"}


@app.post("/ml/analyze", response_model=AnalyzeResponse, tags=["ML"])
def analyze(payload: TelemetryPayload):
    """
    Accept telemetry from the agent-service and return anomaly analysis.
    """
    if not payload.services:
        raise HTTPException(status_code=400, detail="No services provided in payload")

    services_dicts = [s.model_dump() for s in payload.services]

    try:
        result = ml.analyze(services_dicts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    return result


@app.post("/ml/train", response_model=TrainResponse, tags=["ML"])
def train():
    """
    Retrain the IsolationForest on fresh synthetic baseline data and persist it.
    """
    try:
        _, n_samples = ml.train_baseline_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

    return {
        "success": True,
        "message": "Model retrained successfully on synthetic baseline data",
        "samples_used": n_samples,
    }


@app.get("/ml/model-info", response_model=ModelInfoResponse, tags=["ML"])
def model_info():
    """
    Return metadata about the currently loaded model.
    """
    current = ml.get_model()
    if current is None:
        return {
            "loaded": False,
            "features": ml.FEATURES,
            "model_type": "IsolationForest",
            "n_estimators": None,
            "contamination": None,
        }

    return {
        "loaded": True,
        "features": ml.FEATURES,
        "model_type": type(current).__name__,
        "n_estimators": current.n_estimators,
        "contamination": current.contamination,
    }
