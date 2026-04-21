"""Unified async pub/sub event bus for Red and Blue agents.

Blue agent uses: emit() + start()/stop() with FIFO queue worker.
Red agent uses: publish() with direct dispatch + event history.
Both share the same subscriber registry.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List

logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EventBus:
    """Unified event bus supporting both Blue (queued) and Red (direct) dispatch.

    Blue API:
        subscribe(event_type, handler)  — handler(event_type, data)
        emit(event_type, data)          — queued, ordered delivery
        start() / stop()               — manage background worker

    Red API:
        subscribe(event_type, handler)  — handler(data)
        publish(event_type, data)       — direct dispatch + history
        get_history() / clear_history()
    """

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Callable]] = defaultdict(list)
        self._queue: asyncio.Queue = asyncio.Queue()
        self._running: bool = False
        self._worker_task: "asyncio.Task | None" = None
        self._history: List[Dict] = []

    # ------------------------------------------------------------------
    # Shared: subscribe
    # ------------------------------------------------------------------

    def subscribe(self, event_type: str, handler: Callable) -> None:
        self._subscribers[event_type].append(handler)
        logger.debug(f"EventBus: subscribed '{getattr(handler, '__qualname__', str(handler))}' to '{event_type}'")

    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        if handler in self._subscribers.get(event_type, []):
            self._subscribers[event_type].remove(handler)

    # ------------------------------------------------------------------
    # Blue API: queued emit with FIFO worker
    # ------------------------------------------------------------------

    async def emit(self, event_type: str, data: "Dict[str, Any] | None" = None) -> None:
        if data is None:
            data = {}
        await self._queue.put((event_type, data))

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._process_events(), name="event_bus_worker")
        logger.info("EventBus: worker started")

    async def stop(self) -> None:
        self._running = False
        try:
            await asyncio.wait_for(self._queue.join(), timeout=2.0)
        except asyncio.TimeoutError:
            pass
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("EventBus: worker stopped")

    async def _process_events(self) -> None:
        while self._running:
            try:
                event_type, data = await asyncio.wait_for(self._queue.get(), timeout=0.1)
                for handler in self._subscribers.get(event_type, []):
                    try:
                        await handler(event_type, data)
                    except Exception as exc:
                        logger.error(f"EventBus: handler raised on '{event_type}': {exc}")
                self._queue.task_done()
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"EventBus: worker error: {exc}")

    # ------------------------------------------------------------------
    # Red API: direct publish with history
    # ------------------------------------------------------------------

    async def publish(self, event_type: str, data: dict) -> None:
        event = {"type": event_type, "data": data, "timestamp": _utc_now()}
        self._history.append(event)
        logger.info("[EventBus] %s published", event_type)
        for handler in list(self._subscribers.get(event_type, [])):
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(data)
                else:
                    handler(data)
            except Exception as exc:
                logger.error("[EventBus] handler error for %s: %s", event_type, exc)

    def get_history(self) -> list[dict]:
        return list(self._history)

    def clear_history(self) -> None:
        self._history.clear()


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
event_bus = EventBus()
