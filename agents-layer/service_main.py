from __future__ import annotations

from pathlib import Path


def _load_dotenv_if_present() -> None:
    """Load agents-layer/.env for local runs. In Kubernetes use Secret envFrom; .env is not in the image."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.is_file():
        # Do not override real process env (e.g. K8s-injected secrets).
        load_dotenv(env_path, override=False)


_load_dotenv_if_present()

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from lerna_shared.detection import AgentTriggerResponse, DetectionIncident

from lerna_agent.runtime import accept_incident
from lerna_agent.store import WorkflowStore

_pkg_log = logging.getLogger("lerna_agent")
_pkg_log.setLevel(logging.INFO)
if not _pkg_log.handlers:
    _h = logging.StreamHandler(sys.stderr)
    _h.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    _pkg_log.addHandler(_h)
    _pkg_log.propagate = False

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
