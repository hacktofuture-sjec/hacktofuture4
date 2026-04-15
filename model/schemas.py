from pydantic import BaseModel
from typing import List, Optional


class ServiceTelemetry(BaseModel):
    service: str
    latency: float
    restartCount: int
    error: bool
    crash: bool
    overload: bool
    reachable: bool
    replicas: int


class TelemetryPayload(BaseModel):
    services: List[ServiceTelemetry]


class ServiceScore(BaseModel):
    service: str
    anomaly: bool
    score: float


class AnalyzeResponse(BaseModel):
    success: bool
    anomaly: bool
    suspectedService: Optional[str]
    severity: str
    confidence: float
    reason: str
    scores: List[ServiceScore]


class TrainResponse(BaseModel):
    success: bool
    message: str
    samples_used: int


class HealthResponse(BaseModel):
    status: str
    service: str


class ModelInfoResponse(BaseModel):
    loaded: bool
    features: List[str]
    model_type: str
    n_estimators: Optional[int]
    contamination: Optional[float]
