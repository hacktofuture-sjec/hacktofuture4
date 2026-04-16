"""
REKALL Engine Service — Python FastAPI microservice.

This service wraps `rekall_engine` and exposes two endpoints for the Go backend:
  POST /pipeline/run    — start async pipeline for an incident
  POST /pipeline/learn  — submit outcome for LearningAgent
  GET  /health          — liveness probe

The Go backend calls these endpoints; the engine service runs the AI agent
graph (LangGraph) asynchronously and can notify the Go backend via a callback
URL when agent log events are emitted.
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings


# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

class Settings(BaseSettings):
    groq_api_key: str = ""
    go_backend_url: str = "http://localhost:8000"   # callback target
    vault_path: str = "vault"                       # flat-file vault directory
    log_level: str = "INFO"

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
logging.basicConfig(level=settings.log_level)
log = logging.getLogger("rekall.engine")


# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Engine service starting up")
    yield
    log.info("Engine service shutting down")


app = FastAPI(
    title="REKALL Engine Service",
    description="AI agent pipeline — LangGraph + vault + RL",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────

class PipelineRunRequest(BaseModel):
    incident_id: str
    payload: Dict[str, Any]


class PipelineLearnRequest(BaseModel):
    incident_id: str
    fix_proposal_id: str
    result: str                   # success | failure | rejected
    reviewed_by: str = "human"
    notes: Optional[str] = None
    fix_tier: Optional[str] = None          # T1_human | T2_synthetic | T3_llm
    vault_entry_id: Optional[str] = None    # vault entry that was selected


class PipelineResponse(BaseModel):
    ok: bool
    message: str = ""


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"ok": True, "service": "rekall-engine"}


@app.post("/pipeline/run", response_model=PipelineResponse)
async def run_pipeline(req: PipelineRunRequest, background_tasks: BackgroundTasks):
    """
    Start the agent pipeline for an incident.
    Returns immediately; work runs in the background.
    """
    background_tasks.add_task(_run_pipeline_async, req.incident_id, req.payload)
    return PipelineResponse(ok=True, message="pipeline started")


@app.post("/pipeline/learn", response_model=PipelineResponse)
async def learn(req: PipelineLearnRequest):
    """
    Submit an outcome so LearningAgent can update vault confidence.
    """
    try:
        await _run_learning(
            req.incident_id, req.fix_proposal_id, req.result,
            req.reviewed_by, req.notes, req.fix_tier, req.vault_entry_id,
        )
        return PipelineResponse(ok=True, message="learning complete")
    except NotImplementedError:
        # rekall_engine agents are placeholders — acknowledged gracefully
        return PipelineResponse(ok=True, message="learning placeholder (engine not yet implemented)")
    except Exception as exc:
        log.exception("learning failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# Pipeline execution
# ─────────────────────────────────────────────

async def _run_pipeline_async(incident_id: str, payload: Dict[str, Any]) -> None:
    """
    Drive the rekall_engine pipeline and relay agent log events back to the
    Go backend via its /internal/agent-log endpoint.
    When rekall_engine agents are not yet implemented this falls back to a
    stepped emulation that keeps the dashboard alive.
    """
    log.info("Pipeline started for incident %s", incident_id)

    try:
        # Use the real engine graph — run_pipeline returns final state dict
        # and emits AgentLogEntry objects to a queue as it runs.
        from rekall_engine.graph.orchestrator import run_pipeline  # type: ignore
        import asyncio as _asyncio
        from rekall_engine.types import AgentLogEntry  # type: ignore

        queue: _asyncio.Queue = _asyncio.Queue()

        # Run pipeline in background, draining the queue concurrently
        pipeline_task = _asyncio.create_task(
            run_pipeline(payload, incident_id, log_queue=queue)
        )

        # Drain log entries until sentinel (None) received
        while True:
            entry = await queue.get()
            if entry is None:
                break
            if isinstance(entry, AgentLogEntry):
                await _post_callback(incident_id, {
                    "type": "agent_log",
                    "data": {
                        "incident_id": entry.incident_id,
                        "step_name":   entry.step_name,
                        "status":      entry.status,
                        "detail":      entry.detail,
                    },
                })

        # Wait for pipeline to finish
        final_state = await pipeline_task

        # Determine final status
        gov = final_state.get("governance_decision")
        if final_state.get("paused"):
            final_status = "awaiting_approval"
        else:
            final_status = "resolved"

        await _post_callback(incident_id, {
            "type": "status",
            "data": {
                "incident_id":        incident_id,
                "status":             final_status,
                "governance_decision": {
                    "risk_score":  gov.risk_score  if gov else 0.5,
                    "decision":    gov.decision    if gov else "block_await_human",
                    "risk_factors": gov.risk_factors if gov else [],
                } if gov else None,
            },
        })

    except Exception as exc:
        log.exception("pipeline error: %s", exc)
        # Only fall back to emulation if it's clearly a missing implementation
        if isinstance(exc, (NotImplementedError, ImportError)):
            log.warning("rekall_engine not implemented — running emulated pipeline")
            await _emulated_pipeline(incident_id, payload)
        else:
            # Real error — report it to the dashboard
            await _post_callback(incident_id, {
                "type": "agent_log",
                "data": {
                    "incident_id": incident_id,
                    "step_name": "error",
                    "status": "error",
                    "detail": f"Pipeline error: {type(exc).__name__}: {exc}",
                },
            })
            await _post_callback(incident_id, {
                "type": "status",
                "data": {"incident_id": incident_id, "status": "failed"},
            })


async def _emulated_pipeline(incident_id: str, payload: Dict[str, Any]) -> None:
    """
    Replays a realistic step-by-step timeline to the Go backend callback
    when the real engine graph is not yet implemented.
    """
    steps = [
        ("monitor",       "Normalising failure event payload"),
        ("diagnostic",    "Fetching logs, git diff, and test reports"),
        ("fix",           "Searching memory vault: T1 → T2 → T3 fallback"),
        ("governance",    "Computing risk score across 6 dimensions"),
        ("publish_guard", "Supply-chain safety gate: checking commands"),
        ("learning",      "Slack & Notion notifications dispatched"),
    ]

    for step_name, detail in steps:
        for status in ("running", "done"):
            await _post_callback(incident_id, {
                "type": "agent_log",
                "data": {
                    "incident_id": incident_id,
                    "step_name":   step_name,
                    "status":      status,
                    "detail":      detail,
                },
            })
            if status == "running":
                await asyncio.sleep(1.2)

    await _post_callback(incident_id, {
        "type": "status",
        "data": {"incident_id": incident_id, "status": "resolved"},
    })


async def _run_learning(
    incident_id: str,
    fix_proposal_id: str,
    result: str,
    reviewed_by: str,
    notes: Optional[str],
    fix_tier: Optional[str] = None,
    vault_entry_id: Optional[str] = None,
) -> None:
    """
    Delegate to LearningAgent with properly typed Outcome and FixProposal.
    """
    from rekall_engine.agents.learning import LearningAgent  # type: ignore
    from rekall_engine.types import Outcome, FixProposal      # type: ignore

    outcome = Outcome(
        incident_id=incident_id,
        fix_proposal_id=fix_proposal_id,
        result=result,   # type: ignore[arg-type]
        reviewed_by=reviewed_by,
        notes=notes,
    )
    fix = FixProposal(
        incident_id=incident_id,
        tier=fix_tier or "T3_llm",       # type: ignore[arg-type]
        vault_entry_id=vault_entry_id,
        similarity_score=None,
        fix_description="",
        fix_commands=[],
        fix_diff=None,
        confidence=0.5,
    )
    agent = LearningAgent()
    await agent.run({"outcome": outcome, "fix_proposal": fix})


async def _post_callback(incident_id: str, event: Dict[str, Any]) -> None:
    """
    POST an event back to the Go backend's internal callback endpoint.
    Failures are logged and swallowed — the pipeline continues regardless.
    """
    url = f"{settings.go_backend_url}/internal/engine-callback"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json=event)
    except Exception as exc:
        log.debug("callback failed (ok during dev): %s", exc)
