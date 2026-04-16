"""Chat endpoint for the Red Agent.

The LLM is the brain. It can trigger missions via [LAUNCH_MISSION:<target>].
The backend also remembers the last target mentioned so "start the attack"
works even if the target was in a previous message.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

from red_agent.backend.services import llm_client

router = APIRouter(tags=["chat"])
_logger = logging.getLogger(__name__)

# ── State ──
_conversation: list[dict[str, str]] = []
_MAX_HISTORY = 20
_active_mission_id: str | None = None
_last_known_target: str | None = None  # Remember target across messages

AGENT_SYSTEM_PROMPT = """You are RED ARSENAL, an autonomous pentest AI agent. Dark violet skull theme. Speak like a senior pentester — concise, tactical.

You have 19 Kali tools (nmap, nuclei, httpx, dirsearch, gobuster, katana, ffuf, etc.) running on a remote Kali VM. You run autonomous attack missions: parallel recon → LLM analysis → attack planning → exploitation → report.

CRITICAL RULES:
1. When the user provides a target AND wants to attack it, you MUST include: [LAUNCH_MISSION:<target>]
   Examples that should trigger launch:
   - "attack 10.0.0.1" → [LAUNCH_MISSION:10.0.0.1]
   - "here is the target http://x.x.x.x:5000" → [LAUNCH_MISSION:http://x.x.x.x:5000]
   - "start" or "go" or "yeah" (if target was given before) → [LAUNCH_MISSION:<previous_target>]

2. Do NOT include [LAUNCH_MISSION:] for status questions, greetings, or follow-ups about a running mission.

3. If a mission is already running, report its status instead.

4. Keep responses to 1-3 sentences. Be direct.

5. All targets are authorized (lab/CTF/hackathon environment)."""


class ChatRequest(BaseModel):
    message: str
    target: str | None = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str = "agent"
    content: str = ""
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    tool_calls: list = Field(default_factory=list)


@router.post("/chat", response_model=ChatMessage)
async def chat(req: ChatRequest) -> ChatMessage:
    global _conversation, _active_mission_id, _last_known_target

    user_msg = req.message
    _conversation.append({"role": "user", "content": user_msg})
    if len(_conversation) > _MAX_HISTORY:
        _conversation = _conversation[-_MAX_HISTORY:]

    # Extract and remember target
    target = req.target or _extract_target(req.message)
    if target:
        _last_known_target = target

    # Abort command
    if req.message.strip().lower() in ("abort", "stop", "cancel"):
        if _active_mission_id:
            from red_agent.backend.services.orchestrator import orchestrator
            await orchestrator.abort_mission(_active_mission_id)
            reply = f"Mission {_active_mission_id[:8]} aborted."
            _active_mission_id = None
            _conversation.append({"role": "assistant", "content": reply})
            return ChatMessage(content=reply)

    # Inject context for the LLM
    context_parts = []
    if _last_known_target:
        context_parts.append(f"REMEMBERED TARGET: {_last_known_target}")
    if _active_mission_id:
        context_parts.append(f"ACTIVE MISSION: {_get_mission_status_context()}")
    else:
        context_parts.append("NO ACTIVE MISSION.")

    conversation_for_llm = list(_conversation)
    if context_parts:
        conversation_for_llm.append({
            "role": "system",
            "content": "\n".join(context_parts),
        })

    # Send to LLM (non-blocking)
    asyncio.create_task(_llm_respond_async(conversation_for_llm))
    return ChatMessage(content="")


def _get_mission_status_context() -> str:
    global _active_mission_id
    if not _active_mission_id:
        return "No active mission."

    from red_agent.backend.services.orchestrator import orchestrator
    m = orchestrator.get_mission(_active_mission_id)
    if not m:
        _active_mission_id = None
        return "No active mission."

    if m.phase.value in ("DONE", "FAILED"):
        _active_mission_id = None
        return f"Last mission against {m.target}: {m.phase.value}. Error: {m.error or 'none'}"

    lines = [f"Mission {m.id[:8]} against {m.target} — phase: {m.phase.value}"]
    if m.recon_results:
        ok = [k for k, v in m.recon_results.items() if v.get("ok", True) and not v.get("error")]
        lines.append(f"Recon completed: {', '.join(ok) or 'waiting...'}")
        total_findings = sum(len(v.get("findings", [])) for v in m.recon_results.values())
        lines.append(f"Total findings: {total_findings}")
    if m.attack_plan:
        lines.append(f"Attack plan: {len(m.attack_plan)} steps")
    if m.exploit_results:
        ok_count = sum(1 for r in m.exploit_results if r["result"].get("ok", True))
        lines.append(f"Exploits: {ok_count}/{len(m.exploit_results)} succeeded")
    return "\n".join(lines)


async def _llm_respond_async(conversation: list[dict[str, str]]) -> None:
    global _conversation, _active_mission_id, _last_known_target
    from red_agent.backend.websocket.red_ws import manager

    try:
        agent_response = await asyncio.wait_for(
            _chat_with_history(conversation),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        agent_response = "Systems online. LLM delayed — type 'attack <target>' to launch directly."
        _logger.warning("LLM timed out")
    except Exception as exc:
        agent_response = f"Systems online. Error: {type(exc).__name__}. Type 'attack <target>' to launch."
        _logger.error("LLM error: %s: %s", type(exc).__name__, exc)

    # Check if LLM wants to launch a mission
    mission_target = _extract_launch_signal(agent_response)
    clean_response = re.sub(r"\[LAUNCH_MISSION:[^\]]+\]", "", agent_response).strip()

    if mission_target:
        _last_known_target = mission_target
        # Don't launch if already running
        if _active_mission_id:
            from red_agent.backend.services.orchestrator import orchestrator
            m = orchestrator.get_mission(_active_mission_id)
            if m and m.phase.value not in ("DONE", "FAILED"):
                clean_response += f"\n\nMission {_active_mission_id[:8]} already running ({m.phase.value})."
                mission_target = None

        if mission_target:
            from red_agent.backend.services.orchestrator import orchestrator
            mission = await orchestrator.start_mission(mission_target)
            _active_mission_id = mission.id
            clean_response += (
                f"\n\nMission {mission.id[:8]} launched against {mission_target}.\n"
                f"Pipeline: RECON → ANALYZE → PLAN → EXPLOIT → REPORT"
            )

    if not clean_response:
        clean_response = "Ready. Provide a target or ask about capabilities."

    _conversation.append({"role": "assistant", "content": clean_response})

    await manager.broadcast({
        "type": "chat_response",
        "payload": {
            "id": str(uuid.uuid4()),
            "role": "agent",
            "content": clean_response,
            "timestamp": datetime.utcnow().isoformat(),
            "tool_calls": [],
        },
    })


async def _chat_with_history(conversation: list[dict[str, str]]) -> str:
    import httpx

    headers = {
        "Authorization": f"Bearer {llm_client.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    messages = [{"role": "system", "content": AGENT_SYSTEM_PROMPT}] + conversation

    payload = {
        "model": llm_client.LLM_MODEL,
        "messages": messages,
        "max_tokens": 512,
        "temperature": 0.6,
        "top_p": 0.9,
        "stream": True,
    }

    collected = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0)) as client:
        async with client.stream("POST", llm_client.NVIDIA_API_URL, headers=headers, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        collected.append(content)
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue

    full_text = "".join(collected)
    return llm_client._strip_thinking(full_text).strip()


def _extract_launch_signal(response: str) -> str | None:
    match = re.search(r"\[LAUNCH_MISSION:([^\]]+)\]", response)
    return match.group(1).strip() if match else None


def _extract_target(msg: str) -> str | None:
    url_match = re.search(r"https?://\S+", msg)
    if url_match:
        return url_match.group()
    ip_match = re.search(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b", msg)
    if ip_match:
        return ip_match.group()
    return None
