"""
REKALL — Groq API Key Rotation Pool

Supports multiple Groq API keys to avoid free-tier rate limits (429).
Keys are round-robined. On a 429, the current key is skipped and the next
key is tried immediately (up to all keys). Each key then gets a backoff
before being re-added to the rotation.

Configuration (any combination works):
  GROQ_API_KEY=gsk_...                # primary key (always read)
  GROQ_API_KEY_2=gsk_...             # additional keys (up to 10)
  GROQ_API_KEY_3=gsk_...
  ...
  GROQ_API_KEYS=gsk_a,gsk_b,gsk_c   # OR: comma-separated list

If only one key is configured the pool degrades to the original single-key
behaviour with exponential backoff on 429.
"""

from __future__ import annotations

import asyncio
import itertools
import logging
import os
import time
from typing import List, Optional

from groq import AsyncGroq

log = logging.getLogger("rekall.groq_pool")

# Per-key cooldown after a 429 (seconds). Doubles after each consecutive 429.
_COOLDOWN_BASE = 10
_COOLDOWN_MAX  = 120


class _KeySlot:
    def __init__(self, api_key: str, index: int) -> None:
        self.key = api_key
        self.index = index
        self.client = AsyncGroq(api_key=api_key)
        self.cooldown_until: float = 0.0   # epoch seconds
        self.consecutive_429: int = 0

    @property
    def available(self) -> bool:
        return time.monotonic() >= self.cooldown_until

    def on_429(self) -> None:
        self.consecutive_429 += 1
        cooldown = min(_COOLDOWN_BASE * (2 ** (self.consecutive_429 - 1)), _COOLDOWN_MAX)
        self.cooldown_until = time.monotonic() + cooldown
        log.warning("[groq_pool] key[%d] rate-limited — cooling down %.0fs", self.index, cooldown)

    def on_success(self) -> None:
        self.consecutive_429 = 0


class GroqKeyPool:
    """
    Thread-safe (asyncio) pool of Groq API key slots.
    Round-robins across available keys, backs off on 429.
    """

    def __init__(self) -> None:
        self._slots: List[_KeySlot] = []
        self._cycle = itertools.cycle([])  # reset after build
        self._lock = asyncio.Lock()
        self._built = False

    def _build(self) -> None:
        """Collect keys from env and build slots. Called lazily on first use."""
        keys: List[str] = []

        # 1. GROQ_API_KEYS (comma-separated)
        multi = os.getenv("GROQ_API_KEYS", "").strip()
        if multi:
            keys.extend(k.strip() for k in multi.split(",") if k.strip())

        # 2. GROQ_API_KEY (primary)
        primary = os.getenv("GROQ_API_KEY", "").strip()
        if primary and primary not in keys:
            keys.insert(0, primary)

        # 3. GROQ_API_KEY_2 … GROQ_API_KEY_10
        for i in range(2, 11):
            extra = os.getenv(f"GROQ_API_KEY_{i}", "").strip()
            if extra and extra not in keys:
                keys.append(extra)

        if not keys:
            log.warning("[groq_pool] no Groq API keys found — LLM calls will fail")
            keys = [""]   # let groq SDK raise its own error

        self._slots = [_KeySlot(k, i) for i, k in enumerate(keys)]
        self._cycle = itertools.cycle(range(len(self._slots)))
        log.info("[groq_pool] initialized with %d key(s)", len(self._slots))
        self._built = True

    def _ensure_built(self) -> None:
        if not self._built:
            self._build()

    def _next_available_slot(self) -> Optional[_KeySlot]:
        """Return the next available (not cooling down) slot, or None if all are cooling."""
        self._ensure_built()
        n = len(self._slots)
        for _ in range(n):
            idx = next(self._cycle)
            slot = self._slots[idx]
            if slot.available:
                return slot
        # All cooling — return the one with the shortest remaining cooldown
        return min(self._slots, key=lambda s: s.cooldown_until)

    async def call(
        self,
        model: str,
        messages: list,
        max_tokens: int = 2048,
        temperature: float = 0.1,
    ) -> str:
        """
        Make a Groq chat completion call, rotating keys on 429.
        Raises the last exception if all keys fail.
        """
        self._ensure_built()
        n = len(self._slots)
        last_exc: Exception = RuntimeError("No Groq keys configured")

        for attempt in range(n * 2):   # try each key up to twice
            slot = self._next_available_slot()

            # If slot is still cooling, wait out the cooldown
            wait = slot.cooldown_until - time.monotonic()
            if wait > 0:
                log.info("[groq_pool] all keys cooling — waiting %.1fs", wait)
                await asyncio.sleep(wait + 0.1)

            try:
                response = await slot.client.chat.completions.create(
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=messages,
                )
                slot.on_success()
                if not getattr(response, "choices", None):
                    return ""
                return response.choices[0].message.content

            except Exception as exc:
                last_exc = exc
                exc_str = str(exc).lower()
                if "429" in exc_str or "rate_limit" in exc_str or "rate limit" in exc_str:
                    slot.on_429()
                    log.info("[groq_pool] 429 on key[%d] — trying next key (attempt %d/%d)",
                             slot.index, attempt + 1, n * 2)
                    continue
                # Non-rate-limit error — re-raise immediately
                raise

        raise last_exc


# Module-level singleton
_pool: Optional[GroqKeyPool] = None


def get_pool() -> GroqKeyPool:
    global _pool
    if _pool is None:
        _pool = GroqKeyPool()
    return _pool
