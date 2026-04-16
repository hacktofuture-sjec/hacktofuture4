from fastapi import APIRouter

router = APIRouter(tags=["fault-injection"])


@router.post("/inject-fault")
def inject_fault(scenario_id: str = "oom-kill-001") -> dict:
    return {
        "incident_id": "inc-stub-001",
        "scenario_id": scenario_id,
        "status": "injected",
        "message": "Fault injected stub. Connect monitor pipeline next.",
    }
