"""
REKALL — BaseAgent

Shared LLM call logic for all five agents.
Uses the Groq async SDK (OpenAI-compatible chat completions).

Free-tier Groq models used:
  - llama-3.3-70b-versatile  (root agents — 6000 TPM / 30 RPM)
  - llama-3.1-8b-instant     (sub-agents — 20000 TPM / 30 RPM, much faster)
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

from ..config import engine_config
from ..groq_pool import get_pool

log = logging.getLogger("rekall.agent")

# Free-tier Groq models
FREE_TIER_ROOT_MODEL     = "llama-3.3-70b-versatile"   # main agents
FREE_TIER_SUBAGENT_MODEL = "llama-3.1-8b-instant"       # sub-agents (faster)


class BaseAgent(ABC):
    """All REKALL agents inherit from this."""

    name: str = "base"

    async def call_llm(
        self,
        prompt: str,
        system: str = "You are REKALL, an expert CI/CD debugging assistant.",
        max_tokens: int = 2048,
        model: str | None = None,
    ) -> str:
        """
        Call the Groq LLM via the key-rotation pool and return the text response.
        Rotates across GROQ_API_KEY, GROQ_API_KEY_2, … on 429s automatically.
        """
        resolved_model = model or getattr(engine_config, "rlm_model", None) or FREE_TIER_ROOT_MODEL
        log.debug("[%s] calling LLM model=%s max_tokens=%d", self.name, resolved_model, max_tokens)
        return await get_pool().call(
            model=resolved_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": prompt},
            ],
            max_tokens=max_tokens,
        )

    @abstractmethod
    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Each agent takes the shared graph state and returns updated state."""
        ...
