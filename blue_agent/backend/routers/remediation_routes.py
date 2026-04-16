"""Remediation endpoints — Red report ingestion and fix pipeline."""

from typing import List

from fastapi import APIRouter

from blue_agent.backend.schemas.blue_schemas import (
    RedReportRequest,
    RemediationResult,
    RemediationStatus,
    ToolCall,
)
from blue_agent.backend.services import blue_service

router = APIRouter()


@router.post("/ingest-report", response_model=RemediationResult)
async def ingest_red_report(report: RedReportRequest) -> RemediationResult:
    """Receive a Red team pen-test report and trigger simultaneous remediation.

    The Blue Agent will parse each finding and apply fixes in real-time
    while the report is being processed.
    """
    return await blue_service.ingest_red_report(report)


@router.post("/run-sample", response_model=RemediationResult)
async def run_sample_remediation() -> RemediationResult:
    """Run the full remediation pipeline using the sample Red team report.

    Triggers the complete Red → Blue pipeline with the known findings
    from the 172.25.8.172:5000 pen-test.
    """
    return await blue_service.run_sample_remediation()


@router.get("/status", response_model=RemediationStatus)
async def remediation_status() -> RemediationStatus:
    """Get current remediation engine status."""
    return await blue_service.get_remediation_status()


@router.get("/recent", response_model=List[ToolCall])
async def recent_remediation_actions(limit: int = 20) -> List[ToolCall]:
    return await blue_service.recent_tool_calls(category="remediation", limit=limit)
