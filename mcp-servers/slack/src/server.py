"""
Slack MCP Server — FastMCP tools for channel message ingestion.

Tools:
  - health_check
  - get_channel_messages: paginated message history
  - get_thread_replies: replies for a thread
  - list_channels: all public/private channels the bot has access to

Auth: SLACK_BOT_TOKEN env var (Bearer OAuth token, starts with xoxb-).
"""

import logging
import os

import httpx
from fastmcp import FastMCP

logger = logging.getLogger(__name__)

app = FastMCP(
    name="Slack MCP Server",
    description="MCP tools for Slack — channels, messages, threads.",
)

SLACK_BASE_URL = "https://slack.com/api"
_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")


def _headers() -> dict:
    if not _BOT_TOKEN:
        raise RuntimeError("SLACK_BOT_TOKEN env var is not set")
    return {
        "Authorization": f"Bearer {_BOT_TOKEN}",
        "Content-Type": "application/json",
    }


def _check_response(data: dict, method: str) -> None:
    """Raise if Slack API returned ok=false."""
    if not data.get("ok"):
        error = data.get("error", "unknown_error")
        logger.error("[slack] %s failed: %s", method, error)
        raise ValueError(f"Slack API error ({method}): {error}")


@app.tool()
async def health_check() -> dict:
    """Returns MCP server health. Does NOT call Slack API."""
    return {
        "status": "ok",
        "service": "slack-mcp",
        "bot_token_configured": bool(_BOT_TOKEN),
    }


@app.tool()
async def list_channels(
    limit: int = 100,
    cursor: str = "",
    exclude_archived: bool = True,
) -> dict:
    """
    List channels the bot has access to.

    Args:
        limit: Max results (1–200).
        cursor: Pagination cursor from previous response.
        exclude_archived: Skip archived channels.

    Returns:
        {channels, next_cursor}
    """
    limit = max(1, min(limit, 200))
    params: dict = {
        "limit": limit,
        "exclude_archived": exclude_archived,
        "types": "public_channel,private_channel",
    }
    if cursor:
        params["cursor"] = cursor

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{SLACK_BASE_URL}/conversations.list",
            headers=_headers(),
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    _check_response(data, "conversations.list")
    channels = data.get("channels", [])
    next_cursor = data.get("response_metadata", {}).get("next_cursor", "")

    logger.info("[slack] list_channels → %d channels", len(channels))
    return {"channels": channels, "next_cursor": next_cursor, "total": len(channels)}


@app.tool()
async def get_channel_messages(
    channel_id: str,
    limit: int = 100,
    oldest: str = "",
    latest: str = "",
    cursor: str = "",
) -> dict:
    """
    Fetch message history from a Slack channel.

    Args:
        channel_id: Slack channel ID (e.g. C01234ABCD).
        limit: Max messages (1–200).
        oldest: Unix timestamp — only messages after this.
        latest: Unix timestamp — only messages before this.
        cursor: Pagination cursor.

    Returns:
        {messages, has_more, next_cursor}
    """
    limit = max(1, min(limit, 200))
    params: dict = {"channel": channel_id, "limit": limit}
    if oldest:
        params["oldest"] = oldest
    if latest:
        params["latest"] = latest
    if cursor:
        params["cursor"] = cursor

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{SLACK_BASE_URL}/conversations.history",
            headers=_headers(),
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    _check_response(data, "conversations.history")
    messages = data.get("messages", [])
    next_cursor = data.get("response_metadata", {}).get("next_cursor", "")

    logger.info(
        "[slack] get_channel_messages(channel=%s) → %d messages",
        channel_id,
        len(messages),
    )
    return {
        "messages": messages,
        "has_more": data.get("has_more", False),
        "next_cursor": next_cursor,
        "total": len(messages),
    }


@app.tool()
async def get_thread_replies(
    channel_id: str,
    thread_ts: str,
    limit: int = 100,
    cursor: str = "",
) -> dict:
    """
    Fetch all replies in a Slack thread.

    Args:
        channel_id: Slack channel ID containing the thread.
        thread_ts: Timestamp of the parent message (thread root).
        limit: Max replies (1–200).
        cursor: Pagination cursor.

    Returns:
        {messages, has_more, next_cursor} where messages[0] is the parent.
    """
    limit = max(1, min(limit, 200))
    params: dict = {"channel": channel_id, "ts": thread_ts, "limit": limit}
    if cursor:
        params["cursor"] = cursor

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{SLACK_BASE_URL}/conversations.replies",
            headers=_headers(),
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    _check_response(data, "conversations.replies")
    messages = data.get("messages", [])
    next_cursor = data.get("response_metadata", {}).get("next_cursor", "")

    logger.info(
        "[slack] get_thread_replies(ts=%s) → %d messages", thread_ts, len(messages)
    )
    return {
        "messages": messages,
        "has_more": data.get("has_more", False),
        "next_cursor": next_cursor,
        "total": len(messages),
    }


@app.tool()
async def send_message(
    channel_id: str,
    text: str,
    thread_ts: str = "",
) -> dict:
    """
    Send a message to a Slack channel.

    Args:
        channel_id: Slack channel ID (e.g. C01234ABCD).
        text: Message text (supports Slack mrkdwn formatting).
        thread_ts: Optional parent message ts to reply in a thread.

    Returns:
        {ok, channel, ts, message}
    """
    payload: dict = {"channel": channel_id, "text": text}
    if thread_ts:
        payload["thread_ts"] = thread_ts

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{SLACK_BASE_URL}/chat.postMessage",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    _check_response(data, "chat.postMessage")
    logger.info("[slack] send_message(channel=%s) → ts=%s", channel_id, data.get("ts"))
    return {
        "ok": True,
        "channel": data.get("channel"),
        "ts": data.get("ts"),
        "message": data.get("message", {}),
    }

