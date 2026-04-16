"""
Async httpx client for FastAPI → Django service communication.

All database writes must go through Django APIs — never direct DB access.
"""

import logging
from typing import Any, Dict, Optional

import httpx

from .config import settings

logger = logging.getLogger(__name__)

HEADERS = {
    "X-API-Key": settings.django_api_key,
    "Content-Type": "application/json",
}

BASE_URL = settings.django_api_base_url


async def _post_with_retry(
    path: str,
    payload: Dict[str, Any],
    retries: int = 3,
    timeout: float = 30.0,
) -> Dict[str, Any]:
    """POST to Django with exponential-backoff retry."""
    import asyncio

    url = f"{BASE_URL}{path}"
    last_exc: Optional[Exception] = None

    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(1, retries + 1):
            try:
                logger.debug("POST %s attempt=%s", url, attempt)
                response = await client.post(url, json=payload, headers=HEADERS)
                response.raise_for_status()
                data = response.json()
                logger.debug("POST %s → %s %s", url, response.status_code, data)
                return data
            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "Django API %s returned %s (attempt %s/%s)",
                    url,
                    exc.response.status_code,
                    attempt,
                    retries,
                )
                last_exc = exc
                if exc.response.status_code < 500:
                    raise  # 4xx — don't retry
            except (httpx.RequestError, httpx.TimeoutException) as exc:
                logger.warning(
                    "Django API %s network error (attempt %s/%s): %s",
                    url,
                    attempt,
                    retries,
                    exc,
                )
                last_exc = exc

            if attempt < retries:
                await asyncio.sleep(2 ** (attempt - 1))  # 1s, 2s, 4s

    raise RuntimeError(f"Django API {url} failed after {retries} attempts") from last_exc


async def _get_with_retry(
    path: str,
    params: Dict[str, Any],
    retries: int = 3,
    timeout: float = 15.0,
) -> Dict[str, Any]:
    """GET from Django with exponential-backoff retry."""
    import asyncio

    url = f"{BASE_URL}{path}"
    last_exc: Optional[Exception] = None

    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(1, retries + 1):
            try:
                response = await client.get(url, params=params, headers=HEADERS)
                response.raise_for_status()
                return response.json()
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                last_exc = exc
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500:
                    raise
            if attempt < retries:
                await asyncio.sleep(2 ** (attempt - 1))

    raise RuntimeError(f"Django GET {url} failed after {retries} attempts") from last_exc


# ── Public API ─────────────────────────────────────────────────────────────────


async def post_ingest_event(
    organization_id: str,
    integration_id: int,
    event_type: str,
    payload: Dict[str, Any],
    integration_account_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Store a raw webhook event in Django and trigger Celery pipeline."""
    return await _post_with_retry(
        "/api/v1/events/ingest",
        {
            "organization_id": organization_id,
            "integration_id": integration_id,
            "integration_account_id": integration_account_id,
            "event_type": event_type,
            "payload": payload,
        },
    )


async def upsert_ticket(data: Dict[str, Any]) -> Dict[str, Any]:
    """Idempotent ticket upsert via Django API."""
    return await _post_with_retry("/api/v1/tickets/upsert", data)


async def post_dlq(
    event_id: int,
    failure_reason: str,
    error_trace: Dict[str, Any],
    retry_count: int = 3,
) -> Dict[str, Any]:
    """Record a failed event in the Django DLQ."""
    return await _post_with_retry(
        "/api/v1/dlq",
        {
            "event_id": event_id,
            "failure_reason": failure_reason,
            "error_trace": error_trace,
            "retry_count": retry_count,
        },
    )


async def get_identity_map(
    integration_id: int,
    external_user_id: str,
) -> Dict[str, Any]:
    """Resolve external user ID → internal Django user."""
    return await _get_with_retry(
        "/api/v1/identities/map",
        {
            "integration_id": integration_id,
            "external_user_id": external_user_id,
        },
    )
