from pathlib import Path
import sys

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from main import app


client = TestClient(app)


def test_monitor_endpoint_returns_snapshot_shape() -> None:
    response = client.post("/monitor")
    assert response.status_code == 200
    body = response.json()

    assert body["status"] == "ok"
    assert body["agent"] == "monitor"
    snapshot = body["snapshot"]
    assert "metrics" in snapshot
    assert "events" in snapshot
    assert "logs_summary" in snapshot
    assert "collected_at" in snapshot


def test_diagnose_endpoint_uses_rule_engine_for_high_confidence() -> None:
    snapshot = {
        "metrics": {
            "memory_pct": 95.0,
            "cpu_pct": 20.0,
            "restart_count": 1,
            "latency_delta": 1.0,
        },
        "events": ["OOMKilled event detected"],
        "logs_summary": [],
    }

    response = client.post("/diagnose", json=snapshot)
    assert response.status_code == 200
    body = response.json()

    diagnosis = body["diagnosis"]
    assert diagnosis["source"] == "rule"
    assert diagnosis["fingerprint_id"] == "FP-001"
    assert diagnosis["confidence"] >= 0.9


def test_plan_endpoint_formats_context_for_policy_commands() -> None:
    payload = {
        "diagnosis": {
            "fingerprint_id": "FP-001",
            "suggested_actions": [],
        },
        "context": {
            "deployment": "payment-api",
            "namespace": "default",
            "container": "payment-api",
            "image": "payment-api:v2",
        },
    }

    response = client.post("/plan", json=payload)
    assert response.status_code == 200
    body = response.json()

    actions = body["plan"]["actions"]
    assert len(actions) > 0
    assert "payment-api" in actions[0]["command"]
    assert "default" in actions[0]["command"]


def test_pipeline_endpoint_runs_end_to_end() -> None:
    response = client.post("/pipeline", json={"context": {"deployment": "payment-api", "namespace": "default"}})
    assert response.status_code == 200
    body = response.json()

    assert body["status"] == "ok"
    assert body["agent"] == "phase3"
    assert "snapshot" in body
    assert "diagnosis" in body
    assert "plan" in body
    assert body["plan"]["actions"]


def test_cost_report_exposes_runtime_counters() -> None:
    response = client.get("/cost-report")
    assert response.status_code == 200
    body = response.json()

    assert "calls" in body
    assert "total_estimated_cost_usd" in body
    assert "total_actual_cost_usd" in body
    assert "estimated_tokens" in body
    assert "actual_tokens" in body
