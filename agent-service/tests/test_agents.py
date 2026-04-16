"""
Comprehensive agent service validator unit tests.

Tests deterministic validation without any LLM calls.
All 5 validation rules must be tested: status, date, title, external_id, assignee.
"""

import pytest
from unittest.mock import AsyncMock, patch

VALID_STATUS_VALUES = ["open", "in_progress", "blocked", "resolved"]


@pytest.mark.asyncio
async def test_validator_accepts_all_valid_statuses():
    from src.agents.validator import run_validator

    for status in VALID_STATUS_VALUES:
        mapped = {
            "external_ticket_id": "PROJ-1",
            "title": "Valid Title",
            "normalized_status": status,
            "due_date": None,
        }
        with patch(
            "src.agents.validator.get_identity_map",
            new_callable=AsyncMock,
            return_value={"found": False},
        ):
            is_valid, errors = await run_validator(mapped, integration_id=1)
        assert is_valid, f"Status '{status}' should be valid, got errors: {errors}"
        assert errors == []


@pytest.mark.asyncio
async def test_validator_rejects_invalid_status():
    from src.agents.validator import run_validator

    for bad_status in ["INVALID", "todo", "done", "cancelled", ""]:
        mapped = {
            "external_ticket_id": "PROJ-1",
            "title": "Test",
            "normalized_status": bad_status,
            "due_date": None,
        }
        is_valid, errors = await run_validator(mapped, integration_id=1)
        assert not is_valid, f"'{bad_status}' should be invalid"
        assert any("normalized_status" in e for e in errors)


@pytest.mark.asyncio
async def test_validator_accepts_valid_iso8601_date():
    from src.agents.validator import run_validator

    for valid_date in ["2024-12-31", "2025-01-15", "2026-06-01"]:
        mapped = {
            "external_ticket_id": "PROJ-1",
            "title": "Test",
            "normalized_status": "open",
            "due_date": valid_date,
        }
        with patch(
            "src.agents.validator.get_identity_map",
            new_callable=AsyncMock,
            return_value={"found": False},
        ):
            is_valid, errors = await run_validator(mapped, integration_id=1)
        assert is_valid, f"Date '{valid_date}' should be valid, errors: {errors}"


@pytest.mark.asyncio
async def test_validator_rejects_invalid_date_formats():
    from src.agents.validator import run_validator

    for bad_date in ["2024/12/31", "31-12-2024", "not-a-date", "Dec 31 2024"]:
        mapped = {
            "external_ticket_id": "PROJ-1",
            "title": "Test",
            "normalized_status": "open",
            "due_date": bad_date,
        }
        is_valid, errors = await run_validator(mapped, integration_id=1)
        assert not is_valid, f"Date '{bad_date}' should be invalid"
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

    for empty_title in ["", "   ", "\t"]:
        mapped = {
            "external_ticket_id": "PROJ-1",
            "title": empty_title,
            "normalized_status": "open",
            "due_date": None,
        }
        is_valid, errors = await run_validator(mapped, integration_id=1)
        assert not is_valid, f"Empty title '{empty_title!r}' should fail"
        assert any("title" in e for e in errors)


@pytest.mark.asyncio
async def test_validator_rejects_empty_external_id():
    from src.agents.validator import run_validator

    for empty_id in ["", "   "]:
        mapped = {
            "external_ticket_id": empty_id,
            "title": "Valid Title",
            "normalized_status": "resolved",
            "due_date": None,
        }
        is_valid, errors = await run_validator(mapped, integration_id=1)
        assert not is_valid
        assert any("external_ticket_id" in e for e in errors)


@pytest.mark.asyncio
async def test_validator_accumulates_all_errors():
    """When multiple fields are invalid, all errors should be collected."""
    from src.agents.validator import run_validator

    mapped = {
        "external_ticket_id": "",  # invalid
        "title": "",  # invalid
        "normalized_status": "INVALID",  # invalid
        "due_date": "BAD-DATE",  # invalid
    }
    is_valid, errors = await run_validator(mapped, integration_id=1)
    assert not is_valid
    assert len(errors) >= 3  # At minimum: status, title, external_id
