"""
Fetcher agent — MCP-backed provider data fetcher.

Handles:
  - Provider-agnostic interface (driven by config)
  - Rate limit handling (token bucket per provider)
  - Pagination through full dataset
  - Checkpoint-based incremental sync
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# Provider-specific rate limits (requests per second)
RATE_LIMITS: Dict[str, float] = {
    "jira": 10.0,
    "linear": 10.0,
    "hubspot": 5.0,
    "slack": 2.0,
    "github": 5.0,
    "default": 5.0,
}


class TokenBucket:
    """Simple async token bucket for provider rate limiting."""

    def __init__(self, rate: float):
        self.rate = rate  # tokens per second
        self.tokens = rate
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(self.rate, self.tokens + elapsed * self.rate)
            self.last_refill = now

            if self.tokens < 1:
                wait = (1 - self.tokens) / self.rate
                logger.debug("Rate limit: waiting %.2fs", wait)
                await asyncio.sleep(wait)
                self.tokens = 0
            else:
                self.tokens -= 1


_rate_limiters: Dict[str, TokenBucket] = {}


def get_rate_limiter(provider: str) -> TokenBucket:
    if provider not in _rate_limiters:
        rate = RATE_LIMITS.get(provider, RATE_LIMITS["default"])
        _rate_limiters[provider] = TokenBucket(rate)
    return _rate_limiters[provider]


async def fetch_raw_data(
    provider: str,
    config: Dict[str, Any],
    credentials: Dict[str, Any],
    checkpoint: Dict[str, Any],
    max_pages: int = 100,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Fetches paginated raw data from a provider via MCP server.

    Returns:
      (list of raw payloads, updated checkpoint dict)
    """
    rate_limiter = get_rate_limiter(provider)
    records: List[Dict[str, Any]] = []
    next_checkpoint = dict(checkpoint)

    cursor = checkpoint.get("cursor")
    page = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        for _ in range(max_pages):
            await rate_limiter.acquire()

            try:
                response = await _fetch_page(
                    client, provider, config, credentials, cursor
                )
            except Exception as exc:
                logger.exception(
                    "[fetcher] Failed to fetch page %s from %s: %s", page, provider, exc
                )
                break

            items = response.get("items", [])
            records.extend(items)
            page += 1

            logger.debug(
                "[fetcher] Fetched page %s from %s: %s records", page, provider, len(items)
            )

            # Update cursor for next page
            next_cursor = response.get("next_cursor")
            if not next_cursor:
                next_checkpoint.pop("cursor", None)
                break

            cursor = next_cursor
            next_checkpoint["cursor"] = cursor

    logger.info(
        "[fetcher] Completed: provider=%s pages=%s total_records=%s",
        provider,
        page,
        len(records),
    )

    return records, next_checkpoint


async def _fetch_page(
    client: httpx.AsyncClient,
    provider: str,
    config: Dict[str, Any],
    credentials: Dict[str, Any],
    cursor: Optional[str],
) -> Dict[str, Any]:
    """
    Dispatches to the appropriate MCP server endpoint for a single page.
    Provider-agnostic: all providers expose a uniform MCP interface.
    """
    # In production, this would call the MCP server for the provider.
    # For now, returns empty to allow graph wiring without real credentials.
    logger.debug("[fetcher] Fetching from provider=%s cursor=%s", provider, cursor)

    # MCP server base URL would be configured per provider
    mcp_base = config.get("mcp_base_url", f"http://localhost:9000/{provider}")
    params: Dict[str, Any] = {"limit": 50}
    if cursor:
        params["cursor"] = cursor

    resp = await client.get(
        f"{mcp_base}/fetch",
        params=params,
        headers={"Authorization": f"Bearer {credentials.get('api_key', '')}"},
    )
    resp.raise_for_status()
    return resp.json()
