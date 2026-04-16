import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
import json

try:
    from src.main import app
except ImportError:
    pass


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_pipeline_run_success(client):
    """Test POST /pipeline/run successfully processes valid state."""
    mock_state = {
        "is_valid": True,
        "attempt_count": 2,
        "validation_errors": []
    }
    
    with patch("src.routers.pipeline.run_pipeline", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = mock_state
        
        response = await client.post("/pipeline/run", json={
            "event_id": 100,
            "source": "jira",
            "organization_id": "test-org",
            "integration_id": 1,
            "raw_payload": {"key": "val"}
        })

    assert response.status_code == 200
    data = response.json()
    assert data["event_id"] == 100
    assert data["success"] is True
    assert data["attempt_count"] == 2
    assert data["sent_to_dlq"] is False


@pytest.mark.asyncio
async def test_pipeline_run_dlq(client):
    """Test POST /pipeline/run identifies DLQ condition (failed after 3 tries)."""
    mock_state = {
        "is_valid": False,
        "attempt_count": 3,
        "validation_errors": ["status invalid"]
    }
    
    with patch("src.routers.pipeline.run_pipeline", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = mock_state
        
        response = await client.post("/pipeline/run", json={
            "event_id": 101,
            "source": "jira",
            "organization_id": "test-org",
            "integration_id": 1,
            "raw_payload": {}
        })

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["attempt_count"] == 3
    assert data["sent_to_dlq"] is True
    assert "status invalid" in data["validation_errors"]


@pytest.mark.asyncio
async def test_pipeline_action_orchestrator(client):
    """Test /pipeline/action endpoint directly invokes action orchestrator."""
    mock_result = {
        "original_text": "do something",
        "actions_taken": [
            {
                "tool": "jira", 
                "action": "create",
                "details": {"issue": "new"},
                "status": "success",
                "message": "done"
            }
        ],
        "success": True,
        "message": "done"
    }

    with patch("src.agents.action_orchestrator.run_action_orchestrator", new_callable=AsyncMock) as mock_orch:
        mock_orch.return_value = mock_result
        
        response = await client.post("/pipeline/action", json={
            "organization_id": "org1",
            "user_id": "user1",
            "text": "do something"
        })
        
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["actions_taken"][0]["tool"] == "jira"
    mock_orch.assert_called_once_with("do something")


@pytest.mark.asyncio
async def test_pipeline_sync(client):
    """Test /pipeline/sync properly iterates records and posts them to ingest."""
    mock_records = [{"issue": 1}, {"issue": 2}]
    mock_checkpoint = {"cursor": "next"}
    
    with patch("src.agents.fetcher.fetch_raw_data", new_callable=AsyncMock) as mock_fetch, \
         patch("src.django_client.post_ingest_event", new_callable=AsyncMock) as mock_ingest:
        
        mock_fetch.return_value = (mock_records, mock_checkpoint)

        response = await client.post("/pipeline/sync", json={
            "organization_id": "org1",
            "integration_account_id": 2,
            "provider": "jira",
            "config": {},
            "credentials": {},
            "checkpoint": {}
        })
        
    assert response.status_code == 200
    data = response.json()
    assert data["records_processed"] == 2
    assert data["next_checkpoint"] == {"cursor": "next"}
    
    # ingest should be called exactly twice
    assert mock_ingest.call_count == 2
    mock_ingest.assert_any_call(
        organization_id="org1",
        integration_id=2,
        event_type="jira.issue.synced",
        payload={"issue": 1},
        integration_account_id=2
    )


@pytest.mark.asyncio
async def test_pipeline_status_sse(client):
    """Test streaming SEE status events returned correctly."""
    
    # We will patch asyncio.sleep to not actually sleep, speeding up test
    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        async with client.stream("GET", "/pipeline/status/run-1234") as response:
            assert response.status_code == 200
            
            chunks = []
            async for chunk in response.aiter_text():
                if chunk.strip():
                    normalized_chunk = chunk.replace("\r\n", "\n")
                    events = [e for e in normalized_chunk.split("\n\n") if e.strip()]
                    chunks.extend(events)

    assert len(chunks) == 5  # 5 steps in the mock generator
    assert "event: pipeline_status" in chunks[0]
    
    # Extract the data blocks
    data_lines = [c for c in chunks[0].split("\n") if c.startswith("data:")]
    assert len(data_lines) > 0
    payload = json.loads(data_lines[0].replace("data: ", ""))
    assert payload["run_id"] == "run-1234"
    assert payload["status"] == "started"
