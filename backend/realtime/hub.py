from __future__ import annotations

from realtime.broadcaster import WebSocketBroadcaster


# Shared broadcaster used by monitor and incident lifecycle routes.
BROADCASTER = WebSocketBroadcaster()
