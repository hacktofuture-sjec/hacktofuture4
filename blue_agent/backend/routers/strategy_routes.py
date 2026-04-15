"""Strategy endpoints for the Blue Agent."""

from fastapi import APIRouter

from blue_agent.backend.schemas.blue_schemas import (
    DefensePlan,
    StrategyRequest,
)
from blue_agent.backend.services import blue_service

router = APIRouter()


@router.post("/plan", response_model=DefensePlan)
async def plan_defense(request: StrategyRequest) -> DefensePlan:
    return await blue_service.plan_defense(request)


@router.post("/evolve", response_model=DefensePlan)
async def evolve_strategy(request: StrategyRequest) -> DefensePlan:
    return await blue_service.evolve_strategy(request)


@router.get("/current", response_model=DefensePlan)
async def current_strategy() -> DefensePlan:
    return await blue_service.current_strategy()
