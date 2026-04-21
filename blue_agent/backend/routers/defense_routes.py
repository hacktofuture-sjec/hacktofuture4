"""Defense endpoints for the Blue Agent."""

from typing import List

from fastapi import APIRouter

from blue_agent.backend.schemas.blue_schemas import (
    ClosePortRequest,
    DefenseResult,
    HardenServiceRequest,
    IsolateHostRequest,
    ToolCall,
)
from blue_agent.backend.services import blue_service

router = APIRouter()


@router.post("/close_port", response_model=DefenseResult)
async def close_port(request: ClosePortRequest) -> DefenseResult:
    return await blue_service.close_port(request)


@router.post("/harden_service", response_model=DefenseResult)
async def harden_service(request: HardenServiceRequest) -> DefenseResult:
    return await blue_service.harden_service(request)


@router.post("/isolate_host", response_model=DefenseResult)
async def isolate_host(request: IsolateHostRequest) -> DefenseResult:
    return await blue_service.isolate_host(request)


@router.get("/recent", response_model=List[ToolCall])
async def recent_actions(limit: int = 20) -> List[ToolCall]:
    return await blue_service.recent_tool_calls(category="defend", limit=limit)
