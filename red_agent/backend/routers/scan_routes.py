from __future__ import annotations

"""Scan endpoints for the Red Agent."""

from typing import List

from fastapi import APIRouter, HTTPException

from red_agent.backend.schemas.red_schemas import (
    ScanRequest,
    ScanResult,
    ToolCall,
)
from red_agent.backend.services import red_service

router = APIRouter()


@router.post("/network", response_model=ScanResult)
async def scan_network(request: ScanRequest) -> ScanResult:
    try:
        return await red_service.run_network_scan(request)
    except Exception as exc:  # pragma: no cover - bubble to HTTP layer
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/web", response_model=ScanResult)
async def scan_web(request: ScanRequest) -> ScanResult:
    return await red_service.run_web_scan(request)


@router.post("/system", response_model=ScanResult)
async def scan_system(request: ScanRequest) -> ScanResult:
    return await red_service.run_system_scan(request)


@router.post("/cloud", response_model=ScanResult)
async def scan_cloud(request: ScanRequest) -> ScanResult:
    return await red_service.run_cloud_scan(request)


@router.get("/recent", response_model=List[ToolCall])
async def recent_scans(limit: int = 20) -> List[ToolCall]:
    return await red_service.recent_tool_calls(category="scan", limit=limit)
