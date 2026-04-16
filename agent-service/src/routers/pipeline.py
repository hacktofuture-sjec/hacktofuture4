"""
FastAPI router — pipeline endpoints.

POST /pipeline/run      — trigger full LangGraph pipeline
POST /pipeline/sync     — trigger incremental provider sync
GET  /pipeline/status/{run_id} — SSE stream of pipeline status
"""

import logging
import uuid

from fastapi import APIRouter, HTTPException

# from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from ..graph import run_pipeline
from ..schemas import (
    PipelineRunRequest,
    ProcessingResult,
    SyncRequest,
    SyncResult,
    ActionRequest,
    ActionResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])


@router.post("/action", response_model=ActionResult)
async def process_natural_language_action(request: ActionRequest) -> ActionResult:
    """
    Proactive PM: Takes a natural language request, processes it via LLM,
    and executes orchestrated autonomous actions (mocked MCP).
    """
    from ..agents.action_orchestrator import run_action_orchestrator

    logger.info("Natural language action requested for org=%s", request.organization_id)

    try:
        result = await run_action_orchestrator(request.text)
        return result
    except Exception as exc:
        logger.exception("Failed to process natural language action: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/run", response_model=ProcessingResult)
async def run_pipeline_endpoint(request: PipelineRunRequest) -> ProcessingResult:
    """
    Triggers the full LangGraph pipeline for a single raw event.
    Called by Django Celery task after event ingest.
    """
    logger.info(
        "Pipeline run requested: event_id=%s source=%s org=%s",
        request.event_id,
        request.source,
        request.organization_id,
    )

    processing_run_id = str(uuid.uuid4())

    try:
        final_state = await run_pipeline(
            event_id=request.event_id,
            source=request.source,
            raw_payload=request.raw_payload,
            organization_id=request.organization_id,
            integration_id=request.integration_id,
            processing_run_id=processing_run_id,
        )

        sent_to_dlq = final_state.get("attempt_count", 1) >= 3 and not final_state.get(
            "is_valid"
        )

        return ProcessingResult(
            event_id=request.event_id,
            processing_run_id=processing_run_id,
            success=final_state.get("is_valid", False),
            attempt_count=final_state.get("attempt_count", 1),
            sent_to_dlq=sent_to_dlq,
            validation_errors=final_state.get("validation_errors", []),
        )

    except Exception as exc:
        logger.exception("Pipeline failed for event_id=%s: %s", request.event_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/sync", response_model=SyncResult)
async def sync_provider_endpoint(request: SyncRequest) -> SyncResult:
    """
    Triggers incremental sync for a provider integration account.
    Called by Django Celery sync task.
    """
    from ..agents.fetcher import fetch_raw_data
    from ..django_client import post_ingest_event

    logger.info(
        "Sync requested: provider=%s account=%s org=%s",
        request.provider,
        request.integration_account_id,
        request.organization_id,
    )

    records, next_checkpoint = await fetch_raw_data(
        provider=request.provider,
        config=request.config,
        credentials=request.credentials,
        checkpoint=request.checkpoint,
    )

    processed = 0
    for record in records:
        try:
            await post_ingest_event(
                organization_id=request.organization_id,
                integration_id=request.integration_account_id,
                event_type=f"{request.provider}.issue.synced",
                payload=record,
                integration_account_id=request.integration_account_id,
            )
            processed += 1
        except Exception as exc:
            logger.warning("Failed to ingest record during sync: %s", exc)

    return SyncResult(
        next_checkpoint=next_checkpoint,
        records_processed=processed,
    )


@router.get("/status/{run_id}")
async def pipeline_status_stream(run_id: str):
    """
    GET /pipeline/status/{run_id} — SSE stream of pipeline execution status.
    Streams updates as each node completes.
    """
    import asyncio
    import json

    async def event_generator():
        # In production, this would read from Redis pub/sub or a shared store
        # For now, emits a simple status event
        status_steps = ["started", "fetching", "mapping", "validating", "completed"]
        for step in status_steps:
            yield {
                "event": "pipeline_status",
                "data": json.dumps({"run_id": run_id, "status": step}),
            }
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())
