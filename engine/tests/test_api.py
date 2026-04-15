"""
Integration tests for engine service API endpoints.
"""

import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.anyio


async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["service"] == "rekall-engine"


async def test_run_pipeline_returns_immediately(client: AsyncClient):
    """Pipeline should be accepted and run in the background."""
    resp = await client.post("/pipeline/run", json={
        "incident_id": "test-inc-001",
        "payload": {"scenario": "postgres_refused", "simulated": True},
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "started" in data["message"]


async def test_run_pipeline_missing_fields(client: AsyncClient):
    """Missing required fields should return 422."""
    resp = await client.post("/pipeline/run", json={"incident_id": "x"})
    assert resp.status_code == 422


async def test_learn_success(client: AsyncClient):
    """Learn endpoint should accept valid outcomes."""
    resp = await client.post("/pipeline/learn", json={
        "incident_id":    "test-inc-001",
        "fix_proposal_id": "fp-abc",
        "result":         "success",
        "reviewed_by":    "engineer@rekall.io",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True


async def test_learn_invalid_method(client: AsyncClient):
    resp = await client.get("/pipeline/learn")
    assert resp.status_code == 405


async def test_learn_rejected_outcome(client: AsyncClient):
    resp = await client.post("/pipeline/learn", json={
        "incident_id":    "test-inc-002",
        "fix_proposal_id": "fp-xyz",
        "result":         "rejected",
        "reviewed_by":    "senior-eng",
        "notes":          "Fix was too risky for production",
    })
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
