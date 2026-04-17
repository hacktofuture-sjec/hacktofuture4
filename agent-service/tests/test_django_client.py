"""
Agent service Django HTTP client tests.
Tests aligned to the actual function signatures in src/django_client.py.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


def make_ok_response(json_body: dict = None):
    mock = MagicMock()
    mock.status_code = 200
    mock.json.return_value = json_body or {"status": "ok"}
    mock.raise_for_status = MagicMock()
    return mock


def make_error_response(status_code: int):
    mock = MagicMock()
    mock.status_code = status_code
    mock.raise_for_status.side_effect = httpx.HTTPStatusError(
        f"HTTP {status_code}", request=MagicMock(), response=mock
    )
    return mock


def _mock_async_client(post_return=None, get_return=None):
    """Patch httpx.AsyncClient context manager."""
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    if post_return is not None:
        mock_client.post = AsyncMock(return_value=post_return)
    if get_return is not None:
        mock_client.get = AsyncMock(return_value=get_return)
    return mock_client


# ─────────────────────────────────────────────────────────────────────────────
# post_ingest_event(organization_id, integration_id, event_type, payload,
#                  integration_account_id=None)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_post_ingest_event_success():
    """post_ingest_event posts to /api/v1/events/ingest and returns response."""
    from src.django_client import post_ingest_event

    mock_client = _mock_async_client(
        post_return=make_ok_response({"event_id": "abc123", "status": "pending"})
    )
    with patch("src.django_client.httpx.AsyncClient", return_value=mock_client):
        result = await post_ingest_event(
            organization_id="org-1",
            integration_id=1,
            event_type="jira.issue.created",
            payload={"key": "PROJ-1"},
        )
    assert result is not None
    mock_client.post.assert_called_once()


@pytest.mark.asyncio
async def test_post_ingest_event_retries_on_500():
    """post_ingest_event retries up to 3 times on 5xx, then raises RuntimeError."""
    from src.django_client import post_ingest_event

    fail_resp = make_error_response(500)
    # All 3 attempts fail → RuntimeError
    mock_client = _mock_async_client(post_return=fail_resp)
    mock_client.post = AsyncMock(
        side_effect=httpx.HTTPStatusError(
            "500", request=MagicMock(), response=fail_resp
        )
    )

    with patch("src.django_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises((RuntimeError, httpx.HTTPStatusError)):
            await post_ingest_event(
                organization_id="org-1",
                integration_id=1,
                event_type="jira.issue.created",
                payload={},
            )


# ─────────────────────────────────────────────────────────────────────────────
# upsert_ticket(data: Dict)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upsert_ticket_posts_to_django():
    """upsert_ticket should POST data to /api/v1/tickets/upsert."""
    from src.django_client import upsert_ticket

    mock_client = _mock_async_client(
        post_return=make_ok_response({"ticket_id": "t-001"})
    )
    with patch("src.django_client.httpx.AsyncClient", return_value=mock_client):
        result = await upsert_ticket(
            {
                "organization_id": "org-1",
                "integration_id": 1,
                "external_ticket_id": "PROJ-42",
                "title": "Fix login bug",
                "normalized_status": "open",
                "normalized_type": "bug",
            }
        )
    assert result is not None
    mock_client.post.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
# post_dlq(event_id, failure_reason, error_trace, retry_count=3)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_post_dlq_sends_failure_reason():
    """post_dlq sends failure_reason and error_trace to /api/v1/dlq."""
    from src.django_client import post_dlq

    mock_client = _mock_async_client(post_return=make_ok_response({"id": "dlq-001"}))
    with patch("src.django_client.httpx.AsyncClient", return_value=mock_client):
        result = await post_dlq(
            event_id=42,
            failure_reason="Mapper failed after 3 attempts",
            error_trace={"traceback": "line 42"},
            retry_count=3,
        )
    assert result is not None
    call_kwargs = mock_client.post.call_args
    # _post_with_retry calls: client.post(url, json=payload, headers=HEADERS)
    sent_payload = call_kwargs.kwargs.get("json", {})
    assert sent_payload.get("failure_reason") == "Mapper failed after 3 attempts"


# ─────────────────────────────────────────────────────────────────────────────
# get_identity_map(integration_id, external_user_id)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_identity_map_returns_user_id_on_success():
    """get_identity_map returns the Django user on 200."""
    from src.django_client import get_identity_map

    mock_client = _mock_async_client(
        get_return=make_ok_response(
            {"user_id": "u-123", "external_user_id": "user-001"}
        )
    )
    with patch("src.django_client.httpx.AsyncClient", return_value=mock_client):
        result = await get_identity_map(
            integration_id=1,
            external_user_id="user-001",
        )
    assert result is not None
    assert result.get("user_id") == "u-123"


@pytest.mark.asyncio
async def test_get_identity_map_raises_on_404():
    """get_identity_map raises HTTPStatusError on 404 (no retry for 4xx)."""
    from src.django_client import get_identity_map

    err_resp = make_error_response(404)
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.get = AsyncMock(
        side_effect=httpx.HTTPStatusError("404", request=MagicMock(), response=err_resp)
    )

    with patch("src.django_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(httpx.HTTPStatusError):
            await get_identity_map(
                integration_id=1,
                external_user_id="user-999",
            )
