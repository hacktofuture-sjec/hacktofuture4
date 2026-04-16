from fastapi import APIRouter

from agents.phase3_orchestrator import GLOBAL_TOKEN_GOVERNOR

router = APIRouter(tags=["cost"])


@router.get("/cost-report")
def cost_report() -> dict:
    """Return the current token and cost counters for the active incident."""
    return {
        "total_estimated_cost_usd": round(GLOBAL_TOKEN_GOVERNOR.estimated_cost_this_incident, 8),
        "total_actual_cost_usd": round(GLOBAL_TOKEN_GOVERNOR.cost_this_incident, 8),
        "calls": GLOBAL_TOKEN_GOVERNOR.calls_this_incident,
        "estimated_tokens": GLOBAL_TOKEN_GOVERNOR.estimated_tokens_this_incident,
        "actual_tokens": GLOBAL_TOKEN_GOVERNOR.actual_tokens_this_incident,
    }
