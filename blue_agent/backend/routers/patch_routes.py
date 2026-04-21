"""Patching endpoints for the Blue Agent."""

from fastapi import APIRouter

from blue_agent.backend.schemas.blue_schemas import (
    PatchRequest,
    PatchResult,
    VerifyFixRequest,
    VerifyFixResult,
)
from blue_agent.backend.services import blue_service

router = APIRouter()


@router.post("/apply", response_model=PatchResult)
async def apply_patch(request: PatchRequest) -> PatchResult:
    return await blue_service.apply_patch(request)


@router.post("/verify_fix", response_model=VerifyFixResult)
async def verify_fix(request: VerifyFixRequest) -> VerifyFixResult:
    return await blue_service.verify_fix(request)
