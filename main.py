"""HTF root entry point.

Launches the Red (8001) and Blue (8002) FastAPI backends in parallel
inside a single process. Each frontend is started independently from
its own folder via `npm run dev` (Red on 5173, Blue on 5174).
"""

from __future__ import annotations

import asyncio

import uvicorn

from blue_agent.backend.main import BLUE_API_PORT, app as blue_app
from red_agent.backend.main import RED_API_PORT, app as red_app


async def _serve(app, port: int) -> None:
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


async def main() -> None:
    await asyncio.gather(
        _serve(red_app, RED_API_PORT),
        _serve(blue_app, BLUE_API_PORT),
    )


if __name__ == "__main__":
    asyncio.run(main())
