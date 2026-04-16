from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from lerna_shared.detection import AgentTriggerResponse, DetectionIncident

from lerna_agent.runtime import accept_incident
from lerna_agent.store import WorkflowStore

workflow_store = WorkflowStore()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        yield
    finally:
        await workflow_store.close()


app = FastAPI(title="Lerna Agents Service", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/incidents", response_model=AgentTriggerResponse)
async def create_incident_workflow(payload: DetectionIncident) -> AgentTriggerResponse:
    try:
        return await accept_incident(payload, workflow_store)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=502, detail=f"Failed to start incident workflow: {exc}") from exc


@app.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    workflow = await workflow_store.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow
