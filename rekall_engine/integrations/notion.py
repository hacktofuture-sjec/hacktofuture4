"""
REKALL — Notion Integration

Appends incident resolution logs to a Notion database for institutional
auditing (post-mortem reporting).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from ..config import engine_config

log = logging.getLogger("rekall.integrations.notion")


async def log_incident(
    incident_id: str,
    status: str,
    failure_type: str,
    source: str,
    fix_tier: str,
    decision: str,
    confidence: float,
    risk_score: float,
    fix_description: str,
    reviewed_by: str | None = None,
    notes: str | None = None,
) -> bool:
    """Append a new row to the configured Notion Database."""
    if not (engine_config.integrations_enabled and engine_config.notion_token and engine_config.notion_database_id):
        return False

    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {engine_config.notion_token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    # Build properties following standard Notion DB schema for REKALL
    properties = {
        "Incident ID": {"title": [{"text": {"content": incident_id}}]},
        "Status": {"select": {"name": status.capitalize()}},
        "Type": {"select": {"name": failure_type}},
        "Source": {"rich_text": [{"text": {"content": source}}]},
        "Tier": {"select": {"name": fix_tier}},
        "Decision": {"select": {"name": decision}},
        "Confidence": {"number": round(confidence, 4)},
        "Risk Score": {"number": round(risk_score, 4)},
        "Description": {"rich_text": [{"text": {"content": fix_description[:2000]}}]},
        "Reviewer": {"rich_text": [{"text": {"content": reviewed_by or "Auto"}}]},
        "Resolved At": {"date": {"start": datetime.utcnow().isoformat() + "Z"}},
    }
    
    if notes:
        properties["Notes"] = {"rich_text": [{"text": {"content": notes[:2000]}}]}

    payload = {
        "parent": {"database_id": engine_config.notion_database_id},
        "properties": properties,
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if resp.status_code != 200:
                log.warning("[notion] failed to log row: %s %s", resp.status_code, resp.text)
                return False
            return True
    except Exception as exc:
        log.warning("[notion] request exception: %s", exc)
        return False
