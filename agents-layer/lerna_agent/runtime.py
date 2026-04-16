from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict
from uuid import uuid4

from lerna_shared.detection import AgentTriggerResponse, DetectionIncident

from .agent import LernaAgent
from .store import WorkflowStore


def _incident_prompt(incident: DetectionIncident) -> str:
    evidence_lines = [
        f"- [{item.severity}] {item.source}: {item.message}"
        for item in incident.evidence[:8]
    ]
    return "\n".join(
        [
            "Investigate this detected Kubernetes incident and propose the next remediation steps.",
            f"Incident ID: {incident.incident_id}",
            f"Service: {incident.service}",
            f"Namespace: {incident.namespace}",
            f"Severity: {incident.severity}",
            f"Summary: {incident.summary}",
            f"Incident class: {incident.incident_class}",
            "Evidence:",
            *evidence_lines,
        ]
    )


async def execute_incident_workflow(
    incident: DetectionIncident,
    store: WorkflowStore,
    *,
    workflow_id: str,
    model: str | None = None,
) -> Dict[str, Any]:
    started_at = datetime.now(tz=timezone.utc).isoformat()
    workflow = {
        "workflow_id": workflow_id,
        "incident_id": incident.incident_id,
        "status": "running",
        "accepted_at": started_at,
        "started_at": started_at,
        "finished_at": None,
        "result": None,
    }
    await store.save_workflow(workflow_id, workflow)
    try:
        agent = LernaAgent(model=model)
        result = await asyncio.to_thread(agent.run, _incident_prompt(incident))
        workflow["status"] = "completed"
        workflow["result"] = result
    except Exception as exc:  # pylint: disable=broad-except
        workflow["status"] = "failed"
        workflow["result"] = str(exc)
    workflow["finished_at"] = datetime.now(tz=timezone.utc).isoformat()
    await store.save_workflow(workflow_id, workflow)
    return workflow


async def accept_incident(
    incident: DetectionIncident,
    store: WorkflowStore,
) -> AgentTriggerResponse:
    existing = await store.get_workflow_for_incident(incident.incident_id)
    if existing:
        return AgentTriggerResponse(
            accepted=True,
            workflow_id=existing["workflow_id"],
            status=existing["status"],
        )

    workflow_id = f"wf-{uuid4().hex[:12]}"
    initial = {
        "workflow_id": workflow_id,
        "incident_id": incident.incident_id,
        "status": "accepted",
        "accepted_at": datetime.now(tz=timezone.utc).isoformat(),
        "started_at": None,
        "finished_at": None,
        "result": None,
    }
    await store.bind_incident(incident.incident_id, workflow_id)
    await store.save_workflow(workflow_id, initial)
    asyncio.create_task(execute_incident_workflow(incident, store, workflow_id=workflow_id))
    return AgentTriggerResponse(accepted=True, workflow_id=workflow_id, status="accepted")


def manual_incident_from_message(message: str) -> DetectionIncident:
    now = datetime.now(tz=timezone.utc).isoformat()
    return DetectionIncident(
        incident_id=f"manual-{uuid4().hex[:12]}",
        fingerprint=uuid4().hex,
        detected_at=now,
        service="manual-input",
        namespace="default",
        severity="warning",
        summary=message,
        evidence=[],
        cluster_snapshot=None,
        incident_class="manual-investigation",
        dominant_signature=message[:160],
        correlation={},
    )
