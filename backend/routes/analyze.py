from fastapi import APIRouter
from telemetry.aggregator import collect_signals
from anomaly_engine.rule_detector import detect_anomaly
from ai_engine.gemini_analyzer import analyze_incident

router = APIRouter(prefix="/analyze", tags=["Analyze"])

@router.get("/")
def analyze():
    signals = collect_signals()

    if not detect_anomaly(signals):
        return {"status": "Normal"}

    gemini_result = analyze_incident(signals)

    return {
        "status": "Anomaly Detected",
        "gemini_analysis": gemini_result
    }