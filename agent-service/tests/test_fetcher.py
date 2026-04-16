import asyncio
import time
from unittest.mock import AsyncMock, patch

import pytest
try:
    from src.agents.fetcher import TokenBucket, fetch_raw_data, get_rate_limiter
except ImportError:
    pass  # Allow IDE resolution if tests run differently


@pytest.mark.asyncio
async def test_token_bucket_rate_limiting():
    """Ensure TokenBucket limits requests to the specified rate mathematically."""
    bucket = TokenBucket(rate=10.0)  # 10 reqs / sec (i.e. 0.1s per req)

    # First request should be immediate (starting with 10 tokens)
    start_time = time.monotonic()
    await bucket.acquire()
    elapsed = time.monotonic() - start_time
    assert elapsed < 0.05

    # Exhaust the tokens artificially to force a wait
    bucket.tokens = 0.0
    
    start_time = time.monotonic()
    await bucket.acquire()
    elapsed = time.monotonic() - start_time
    
    # We requested 1 token. At 10t/s, we wait approx 0.1s. 
    # Give some buffer for asyncio event loop precision.
    assert 0.08 <= elapsed <= 0.25


@pytest.mark.asyncio
async def test_get_rate_limiter_memoization():
    """Ensure rate limiters are cached per provider."""
    jira_limiter = get_rate_limiter("jira")
    jira_limiter2 = get_rate_limiter("jira")
    default_limiter = get_rate_limiter("unknown_provider")

    assert jira_limiter is jira_limiter2
    assert jira_limiter is not default_limiter


@pytest.mark.asyncio
async def test_fetch_raw_data_pagination_success():
    """Ensure the fetcher paginates through cursors and updates the checkpoint."""
    mock_responses = [
        {"items": [{"id": 1}, {"id": 2}], "next_cursor": "page2"},
        {"items": [{"id": 3}, {"id": 4}], "next_cursor": "page3"},
        {"items": [{"id": 5}], "next_cursor": None},  # Final page
    ]

    with patch("src.agents.fetcher._fetch_page", side_effect=mock_responses) as mock_fetch:
        records, next_checkpoint = await fetch_raw_data(
            provider="jira",
            config={},
            credentials={"api_key": "test_key"},
            checkpoint={"last_synced": "2024-01-01"},
            max_pages=10
        )

    # Validations
    assert mock_fetch.call_count == 3
    assert len(records) == 5
    assert [r["id"] for r in records] == [1, 2, 3, 4, 5]
    
    # Checkpoint validations
    assert next_checkpoint.get("last_synced") == "2024-01-01"
    assert "cursor" not in next_checkpoint  # Cursor removed on exhausted list


@pytest.mark.asyncio
async def test_fetch_raw_data_max_pages_limit():
    """Ensure the fetcher obeys max_pages cutoff to prevent infinite loops."""
    # A generator simulating infinite pagination
    async def infinite_mock(*args, **kwargs):
        return {"items": [{"id": 99}], "next_cursor": "never_ends"}

    with patch("src.agents.fetcher._fetch_page", side_effect=infinite_mock) as mock_fetch:
        records, next_checkpoint = await fetch_raw_data(
            provider="jira",
            config={},
            credentials={},
            checkpoint={},
            max_pages=3
        )

    assert mock_fetch.call_count == 3
    assert len(records) == 3
    
    # Cursor MUST persist since it was cutoff prematurely!
    assert next_checkpoint.get("cursor") == "never_ends"


@pytest.mark.asyncio
async def test_fetch_raw_data_handles_exceptions_gracefully():
    """Ensure the fetcher exits gracefully on a network exception mid-pagination."""
    async def failing_fetch(*args, **kwargs):
        cursor = args[-1]  # The cursor is the 5th argument in _fetch_page
        if cursor == "fail_here":
            raise Exception("MCP Server Error")
        return {"items": [{"id": 1}], "next_cursor": "fail_here"}

    with patch("src.agents.fetcher._fetch_page", side_effect=failing_fetch) as mock_fetch:
        records, next_checkpoint = await fetch_raw_data(
            provider="jira",
            config={},
            credentials={},
            checkpoint={},
            max_pages=5
        )

    # Should fetch the first page, then fail on the second.
    assert mock_fetch.call_count == 2
    assert len(records) == 1
    # Checkpoint must save the last cursor it successfully attempted to request
    assert next_checkpoint.get("cursor") == "fail_here"


@pytest.mark.asyncio
async def test_internal_fetch_page_http_request(httpx_mock):
    """Test the internal _fetch_page function sends the correct HTTP reqs."""
    from src.agents.fetcher import _fetch_page
    import httpx

    httpx_mock.add_response(
        json={"items": [], "next_cursor": None},
        status_code=200
    )

    async with httpx.AsyncClient() as client:
        resp = await _fetch_page(
            client=client,
            provider="jira",
            config={"mcp_base_url": "http://mock.mcp/jira"},
            credentials={"api_key": "secret123"},
            cursor="my_cursor"
        )
    
    assert resp["items"] == []
    
    req = httpx_mock.get_request()
    assert str(req.url) == "http://mock.mcp/jira/fetch?limit=50&cursor=my_cursor"
    assert req.headers["authorization"] == "Bearer secret123"
