from __future__ import annotations

import logging
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["mission"])
_logger = logging.getLogger(__name__)


class MissionLaunchRequest(BaseModel):
    target: str
    attack_type: str = "full"


@router.post("/mission/launch")
async def launch_mission(req: MissionLaunchRequest) -> dict:
    """Launch a crew mission directly — no LLM chat round-trip."""
    try:
        from red_agent.backend.services.orchestrator import orchestrator
        mission = await orchestrator.start_mission(req.target)
        _logger.info("Mission %s launched: %s (type=%s)", mission.id[:8], req.target, req.attack_type)
        return {
            "mission_id": mission.id,
            "target": req.target,
            "attack_type": req.attack_type,
            "status": "started",
        }
    except Exception as exc:
        _logger.error("Mission launch failed: %s", exc, exc_info=True)
        return {
            "mission_id": None,
            "target": req.target,
            "attack_type": req.attack_type,
            "status": "failed",
            "error": str(exc),
        }


@router.get("/mission/status/{mission_id}")
async def mission_status(mission_id: str) -> dict:
    """Get the current status of a mission."""
    try:
        from red_agent.backend.services.orchestrator import orchestrator
        mission = orchestrator.get_mission(mission_id)
        if not mission:
            return {"mission_id": mission_id, "status": "not_found"}
        return {
            "mission_id": mission.id,
            "target": mission.target,
            "phase": mission.phase.value,
            "error": mission.error,
        }
    except Exception as exc:
        return {"mission_id": mission_id, "status": "error", "error": str(exc)}
