"""
Agent service — validator unit tests.
"""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_validator_rejects_invalid_status():
    from src.agents.validator import run_validator

    mapped = {
        "external_ticket_id": "PROJ-1",
        "title": "Test",
        "normalized_status": "INVALID_STATUS",
        "due_date": None,
    }
    is_valid, errors = await run_validator(mapped, integration_id=1)
    assert not is_valid
    assert any("normalized_status" in e for e in errors)


@pytest.mark.asyncio
async def test_validator_rejects_invalid_date():
    from src.agents.validator import run_validator

    mapped = {
        "external_ticket_id": "PROJ-1",
        "title": "Test",
        "normalized_status": "open",
        "due_date": "not-a-date",
    }
    is_valid, errors = await run_validator(mapped, integration_id=1)
    assert not is_valid
    assert any("due_date" in e for e in errors)


@pytest.mark.asyncio
async def test_validator_accepts_null_due_date():
    from src.agents.validator import run_validator

    mapped = {
        "external_ticket_id": "PROJ-1",
        "title": "Test",
        "normalized_status": "open",
        "due_date": None,
    }
    with patch(
        "src.agents.validator.get_identity_map",
        new_callable=AsyncMock,
        return_value={"found": False},
    ):
        is_valid, errors = await run_validator(mapped, integration_id=1)
    assert is_valid
    assert errors == []


@pytest.mark.asyncio
async def test_validator_rejects_empty_title():
    from src.agents.validator import run_validator

    mapped = {
        "external_ticket_id": "PROJ-1",
        "title": "",
        "normalized_status": "open",
        "due_date": None,
    }
    is_valid, errors = await run_validator(mapped, integration_id=1)
    assert not is_valid
    assert any("title" in e for e in errors)


@pytest.mark.asyncio
async def test_validator_rejects_empty_external_id():
    from src.agents.validator import run_validator

    mapped = {
        "external_ticket_id": "",
        "title": "Valid Title",
        "normalized_status": "resolved",
        "due_date": None,
    }
    is_valid, errors = await run_validator(mapped, integration_id=1)
    assert not is_valid
    assert any("external_ticket_id" in e for e in errors)
