"""Strategy endpoints for the Red Agent."""

from fastapi import APIRouter

from red_agent.backend.schemas.red_schemas import (
    StrategyPlan,
    StrategyRequest,
)
from red_agent.backend.services import red_service

router = APIRouter()


@router.post("/plan", response_model=StrategyPlan)
async def plan_attack(request: StrategyRequest) -> StrategyPlan:
    return await red_service.plan_attack(request)


@router.post("/evolve", response_model=StrategyPlan)
async def evolve_strategy(request: StrategyRequest) -> StrategyPlan:
    return await red_service.evolve_strategy(request)


@router.get("/current", response_model=StrategyPlan)
async def current_strategy() -> StrategyPlan:
    return await red_service.current_strategy()
