from pathlib import Path
import sys

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from main import app
from planner.plan_simulator import simulate_action
from planner.planner_agent import PlannerAgent


client = TestClient(app)


def test_planner_agent_uses_policy_catalog_for_fingerprint_match() -> None:
    planner = PlannerAgent()
    diagnosis = {
        "fingerprint_id": "FP-001",
        "confidence": 0.95,
        "suggested_actions": [],
    }
    snapshot = {
        "dependency_graph_summary": "frontend -> payment-api -> db",
        "has_rollback_revision": True,
    }
    context = {
        "deployment": "payment-api",
        "namespace": "default",
        "container": "payment-api",
        "image": "payment-api",
    }

    output = planner.run(diagnosis=diagnosis, snapshot=snapshot, context=context)

    assert output.actions
    assert "payment-api" in output.actions[0].action
    assert output.actions[0].simulation_result.blast_radius_score >= 0.0


def test_simulator_flags_broad_impact_for_high_risk_change() -> None:
    action = {
        "command": "kubectl rollout undo deployment/payment-api -n default",
        "risk": "high",
        "approval_required": False,
    }
    snapshot = {
        "dependency_graph_summary": "high error rate in downstream services",
        "has_rollback_revision": True,
    }

    result = simulate_action(action, snapshot)

    assert result.dependency_impact.value == "broad"


def test_incident_plan_endpoint_persists_actions() -> None:
    payload = {
        "diagnosis": {
            "fingerprint_id": "FP-001",
            "confidence": 0.92,
            "suggested_actions": [],
        },
        "context": {
            "deployment": "payment-api",
            "namespace": "default",
            "container": "payment-api",
            "image": "payment-api",
        },
    }

    response = client.post("/incidents/inc-001/plan", json=payload)
    assert response.status_code == 200
    body = response.json()

    assert body["incident_id"] == "inc-001"
    assert body["plan"]["actions"]


def test_incident_simulate_endpoint_recomputes_action_result() -> None:
    plan_payload = {
        "diagnosis": {
            "fingerprint_id": "FP-002",
            "confidence": 0.9,
            "suggested_actions": [],
        },
        "context": {
            "deployment": "payment-api",
            "namespace": "default",
            "container": "payment-api",
            "image": "payment-api",
        },
    }
    client.post("/incidents/inc-001/plan", json=plan_payload)

    response = client.post(
        "/incidents/inc-001/simulate",
        json={"action_index": 0, "has_rollback_revision": False},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["action_index"] == 0
    assert "simulation_result" in body


def test_incident_approve_endpoint_transitions_status() -> None:
    response = client.post("/incidents/inc-001/approve")
    assert response.status_code == 200
    body = response.json()

    assert body["incident_id"] == "inc-001"
    assert body["status"] == "approved"
