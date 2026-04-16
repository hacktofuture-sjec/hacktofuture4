"""
REKALL — BaseAgent

Shared LLM call logic for all five agents.
Uses the Groq async SDK (OpenAI-compatible chat completions).

Free-tier Groq models used:
  - llama-3.3-70b-versatile  (root agents — 6000 TPM / 30 RPM)
  - llama-3.1-8b-instant     (sub-agents — 20000 TPM / 30 RPM, much faster)
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

from groq import AsyncGroq

from ..config import engine_config

log = logging.getLogger("rekall.agent")

# Free-tier Groq models
FREE_TIER_ROOT_MODEL    = "llama-3.3-70b-versatile"   # main agents
FREE_TIER_SUBAGENT_MODEL = "llama-3.1-8b-instant"      # sub-agents (faster)


class BaseAgent(ABC):
    """All REKALL agents inherit from this."""

    name: str = "base"
    _client: Optional[AsyncGroq] = None

    def _get_client(self) -> AsyncGroq:
        if self.__class__._client is None:
            self.__class__._client = AsyncGroq(
                api_key=engine_config.groq_api_key or None
            )
        return self.__class__._client

    async def call_llm(
        self,
        prompt: str,
        system: str = "You are REKALL, an expert CI/CD debugging assistant.",
        max_tokens: int = 2048,
        model: str | None = None,
    ) -> str:
        """
        Call the Groq LLM and return the text response.
        Shared by all agents — raises on API error.

        Uses llama-3.3-70b-versatile by default (free tier).
        Pass model='llama-3.1-8b-instant' for sub-agent calls to save quota.
        """
        client = self._get_client()
        # Prefer explicit override, then config, then free-tier default
        resolved_model = model or getattr(engine_config, "rlm_model", None) or FREE_TIER_ROOT_MODEL
        log.debug("[%s] calling LLM model=%s max_tokens=%d", self.name, resolved_model, max_tokens)
        response = await client.chat.completions.create(
            model=resolved_model,
            max_tokens=max_tokens,
            temperature=0.1,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": prompt},
            ],
        )
        return response.choices[0].message.content

    @abstractmethod
    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Each agent takes the shared graph state and returns updated state."""
        ...
