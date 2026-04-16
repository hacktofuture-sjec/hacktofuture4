from fastapi import APIRouter

router = APIRouter(tags=["scenarios"])


@router.get("/scenarios")
def list_scenarios() -> list[dict]:
    return [
        {
            "scenario_id": "oom-kill-001",
            "name": "Memory Exhaustion",
            "failure_class": "resource",
        }
    ]


@router.post("/admin/load-scenarios")
def load_scenarios() -> dict:
    return {"loaded": 1, "scenarios": ["oom-kill-001"]}
