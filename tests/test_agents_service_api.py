from fastapi.testclient import TestClient

from lerna_shared.detection import AgentTriggerResponse
from service_main import app, workflow_store


def test_post_incidents_returns_trigger_response(monkeypatch):
    payload = {
        "incident_id": "inc-123",
        "fingerprint": "fp-123",
        "detected_at": "2026-04-16T00:00:00Z",
        "service": "payment-service",
        "namespace": "lerna",
        "severity": "error",
        "summary": "application-error detected for payment-service",
        "evidence": [],
        "cluster_snapshot": None,
        "incident_class": "application-error",
        "dominant_signature": "fatal timeout",
        "correlation": {},
    }

    async def fake_accept_incident(_payload, _store):
        return AgentTriggerResponse(accepted=True, workflow_id="wf-123", status="accepted")

    monkeypatch.setattr("service_main.accept_incident", fake_accept_incident)

    with TestClient(app) as client:
        response = client.post("/incidents", json=payload)

    assert response.status_code == 200
    assert response.json()["workflow_id"] == "wf-123"


def test_get_workflow_reads_store(monkeypatch):
    async def fake_get_workflow(_workflow_id):
        return {"workflow_id": "wf-123", "status": "completed"}

    monkeypatch.setattr(workflow_store, "get_workflow", fake_get_workflow)

    with TestClient(app) as client:
        response = client.get("/workflows/wf-123")

    assert response.status_code == 200
    assert response.json()["status"] == "completed"
