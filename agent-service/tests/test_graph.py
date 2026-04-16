"""
LangGraph pipeline graph tests.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_graph_valid_payload_does_not_go_to_dlq():
    """A valid payload should NOT be sent to DLQ."""
    from src.graph import run_pipeline

    valid_mapped = {
        "external_ticket_id": "PROJ-1",
        "title": "Fix login bug",
        "normalized_status": "open",
        "normalized_type": "bug",
        "priority": "high",
        "due_date": None,
        "labels": [],
        "provider_metadata": {},
        "description": "",
        "assignee_external_id": None,
        "reporter_external_id": None,
        "source_created_at": None,
        "source_updated_at": None,
    }

    with (
        patch("src.graph.run_mapper", new_callable=AsyncMock, return_value=valid_mapped),
        patch("src.graph.run_validator", new_callable=AsyncMock, return_value=(True, [])),
        patch("src.graph.upsert_ticket", new_callable=AsyncMock, return_value={"ticket_id": 1, "created": True}),
        patch("src.graph.post_dlq", new_callable=AsyncMock) as mock_dlq,
    ):
        result = await run_pipeline(
            event_id=1,
            source="jira",
            raw_payload={"test": True},
            organization_id="test-org",
            integration_id=1,
        )

    # DLQ should NOT have been called
    mock_dlq.assert_not_called()
    assert result["is_valid"] is True


@pytest.mark.asyncio
async def test_graph_invalid_payload_eventually_goes_to_dlq():
    """After 3 failed validation attempts, DLQ should be called."""
    from src.graph import run_pipeline

    failed_mapped = {
        "external_ticket_id": "PROJ-1",
        "title": "Test",
        "normalized_status": "INVALID",  # Will always fail validation
        "normalized_type": "task",
        "priority": "none",
        "due_date": None,
        "labels": [],
        "provider_metadata": {},
        "description": "",
        "assignee_external_id": None,
        "reporter_external_id": None,
        "source_created_at": None,
        "source_updated_at": None,
    }

    with (
        patch("src.graph.run_mapper", new_callable=AsyncMock, return_value=failed_mapped),
        patch(
            "src.graph.run_validator",
            new_callable=AsyncMock,
            return_value=(False, ["normalized_status must be one of..."]),
        ),
        patch("src.graph.upsert_ticket", new_callable=AsyncMock),
        patch("src.graph.post_dlq", new_callable=AsyncMock) as mock_dlq,
    ):
        result = await run_pipeline(
            event_id=2,
            source="jira",
            raw_payload={"test": True},
            organization_id="test-org",
            integration_id=1,
        )

    # DLQ should have been called
    mock_dlq.assert_called_once()
    assert result["is_valid"] is False
