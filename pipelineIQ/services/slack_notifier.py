from __future__ import annotations

from typing import Any

import httpx

from config import settings


async def post_slack_message(*, text: str, blocks: list[dict[str, Any]] | None = None) -> bool:
    if not settings.SLACK_ENABLED or not settings.SLACK_WEBHOOK_URL:
        return False

    payload: dict[str, Any] = {"text": text}
    if blocks:
        payload["blocks"] = blocks

    async with httpx.AsyncClient() as client:
        response = await client.post(settings.SLACK_WEBHOOK_URL, json=payload, timeout=15.0)
        response.raise_for_status()

    return True
