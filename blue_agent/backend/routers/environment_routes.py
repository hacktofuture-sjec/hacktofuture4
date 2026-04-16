"""Environment monitoring endpoints for the Blue Agent."""

from typing import List, Optional

from fastapi import APIRouter

from blue_agent.backend.schemas.blue_schemas import (
    EnvironmentAlertInfo,
    EnvironmentStats,
)
from blue_agent.backend.services import blue_service

router = APIRouter()


@router.get("/alerts", response_model=List[EnvironmentAlertInfo])
async def get_alerts(environment: Optional[str] = None) -> List[EnvironmentAlertInfo]:
    """Return environment security alerts, optionally filtered."""
    return await blue_service.get_environment_alerts(environment=environment)


@router.get("/stats", response_model=EnvironmentStats)
async def get_env_stats() -> EnvironmentStats:
    """Return environment monitoring statistics."""
    return await blue_service.get_environment_stats()
