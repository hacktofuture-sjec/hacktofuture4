from fastapi import APIRouter
from telemetry.aggregator import collect_signals
from ai_engine.gemini_analyzer import analyze_incident
from recovery_engine.executor import execute_recovery

router = APIRouter(prefix="/recovery", tags=["Recovery"])

@router.post("/execute")
def recover():
    signals = collect_signals()
    analysis = analyze_incident(signals)

    if "scale" in analysis.lower():
        action = "scale"
    elif "rollback" in analysis.lower():
        action = "rollback"
    elif "isolate" in analysis.lower():
        action = "isolate"
    else:
        action = "restart"

    result = execute_recovery(action)

    return {
        "analysis": analysis,
        "selected_action": action,
        "execution_result": result
    }