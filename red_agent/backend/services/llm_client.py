"""LLM client for the Red Agent — uses NVIDIA API with Qwen model.

Provides async `chat()` for the orchestrator to get intelligent analysis,
attack planning, and reporting from the LLM.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

_logger = logging.getLogger(__name__)

NVIDIA_API_URL = os.environ.get(
    "LLM_API_URL",
    "https://integrate.api.nvidia.com/v1/chat/completions",
)
NVIDIA_API_KEY = os.environ.get(
    "NVIDIA_API_KEY",
    "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",
)
LLM_MODEL = os.environ.get("LLM_MODEL", "meta/llama-3.1-70b-instruct")

# System prompt that makes the LLM act as a red team agent
RED_AGENT_SYSTEM_PROMPT = """You are an autonomous red team AI agent specializing in offensive security.
Your role is to analyze reconnaissance data, identify vulnerabilities, plan attack strategies, and generate security assessment reports.

You think step-by-step and provide actionable, structured output.
When analyzing recon data, focus on:
- Open ports and their associated services
- Known vulnerabilities (CVEs) for discovered services
- Misconfigurations and weak points
- Attack surface and entry points

When planning attacks, prioritize:
- Critical and high severity vulnerabilities first
- Service-specific exploits
- Directory traversal and fuzzing opportunities
- Credential attacks on exposed services

Always respond with structured, parseable content. Use JSON when asked for structured output.
Be concise and technical — this is an automated pipeline, not a conversation."""


async def chat(
    prompt: str,
    *,
    system: str = RED_AGENT_SYSTEM_PROMPT,
    temperature: float = 0.6,
    max_tokens: int = 4096,
) -> str:
    """Send a prompt to the LLM and return the text response.

    Uses NVIDIA API (OpenAI-compatible chat completions format).
    Falls back to a simple summary if the API call fails.
    """
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": 0.95,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(NVIDIA_API_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

            # Extract the assistant message content
            choices = data.get("choices", [])
            if choices:
                content = choices[0].get("message", {}).get("content", "")
                # Strip thinking tags if the model includes them
                content = _strip_thinking(content)
                return content.strip()

            _logger.warning("LLM returned no choices: %s", data)
            return ""

    except Exception as exc:
        _logger.error("LLM API call failed: %s", exc)
        raise


async def chat_json(
    prompt: str,
    *,
    system: str = RED_AGENT_SYSTEM_PROMPT,
    temperature: float = 0.4,
    max_tokens: int = 4096,
) -> dict[str, Any]:
    """Send a prompt and parse the response as JSON.

    Adds an instruction to respond in JSON format. If parsing fails,
    returns the raw text wrapped in a dict.
    """
    json_prompt = prompt + "\n\nRespond ONLY with valid JSON. No markdown, no code fences, no explanation."
    text = await chat(json_prompt, system=system, temperature=temperature, max_tokens=max_tokens)

    # Try to extract JSON from the response
    try:
        # Handle cases where model wraps JSON in code fences
        cleaned = text
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0]
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0]
        return json.loads(cleaned.strip())
    except (json.JSONDecodeError, IndexError):
        return {"raw_response": text}


def _strip_thinking(text: str) -> str:
    """Remove <think>...</think> blocks that Qwen models may include."""
    import re
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
