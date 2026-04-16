"""
REKALL — Slack Integration

Sends rich Block Kit messages to Slack for governance notifications
and final incident outcomes.
"""

from __future__ import annotations

import logging
from typing import Any, List

import httpx

from ..config import engine_config

log = logging.getLogger("rekall.integrations.slack")


async def notify_governance(
    incident_id: str,
    failure_type: str,
    source: str,
    risk_score: float,
    decision: str,
    risk_factors: List[str],
    fix_description: str,
    fix_tier: str,
    confidence: float,
) -> bool:
    """Send a pending approval / risk score notification to Slack."""
    if not engine_config.integrations_enabled or not engine_config.slack_webhook_url:
        return False

    # Build ASCII risk bar: [████░░░░░░]
    bar_len = 10
    filled = int(risk_score * bar_len)
    bar = "█" * filled + "░" * (bar_len - filled)
    
    color = "#e01e5a" if risk_score > 0.70 else "#ecb22e" if risk_score > 0.30 else "#2eb67d"
    
    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "🛡️ REKALL Governance Decision"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Incident ID:*\n`{incident_id[:8]}`"},
                {"type": "mrkdwn", "text": f"*Source:*\n{source}"},
                {"type": "mrkdwn", "text": f"*Type:*\n{failure_type}"},
                {"type": "mrkdwn", "text": f"*Tier:*\n{fix_tier}"},
            ],
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Risk Score:* `{risk_score:.2f}`\n`[{bar}]` → *{decision.upper()}*",
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Fix Proposal:* {fix_description[:200]}...",
            },
        },
    ]

    if risk_factors:
        factors_str = ", ".join([f"`{f}`" for f in risk_factors])
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"*Risk Factors:* {factors_str}"}]
        })

    payload = {
        "text": f"REKALL Governance: {decision} for incident {incident_id[:8]}",
        "blocks": blocks,
    }

    return await _send(payload)


async def notify_outcome(
    incident_id: str,
    source: str,
    outcome: str,
    fix_tier: str,
    confidence: float,
    reviewed_by: str | None = None,
    notes: str | None = None,
) -> bool:
    """Send final incident resolution outcome to Slack."""
    if not engine_config.integrations_enabled or not engine_config.slack_webhook_url:
        return False

    status_emoji = "✅" if outcome == "success" else "❌" if outcome == "failure" else "⚠️"
    
    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"{status_emoji} *Incident {incident_id[:8]} Resolved*"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Result:*\n{outcome.capitalize()}"},
                {"type": "mrkdwn", "text": f"*TIer:*\n{fix_tier}"},
                {"type": "mrkdwn", "text": f"*Confidence:*\n{confidence:.0%}"},
                {"type": "mrkdwn", "text": f"*Reviewer:*\n{reviewed_by or 'Automatic'}"},
            ],
        },
    ]

    if notes:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Notes:* {notes}"}
        })

    payload = {
        "text": f"REKALL Outcome: {outcome} for incident {incident_id[:8]}",
        "blocks": blocks,
    }

    return await _send(payload)


async def _send(payload: dict) -> bool:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(engine_config.slack_webhook_url, json=payload, timeout=5.0)
            resp.raise_for_status()
            return True
    except Exception as exc:
        log.warning("[slack] failed to send notification: %s", exc)
        return False
