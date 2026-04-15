"""Quick introspection: ask the server which binaries it resolves.

Use this after deploying changes to confirm the service's PATH is finding
the right versions of every tool — independent of the invoking user's
shell PATH.
"""

from __future__ import annotations

import asyncio
import json

from fastmcp import Client

SERVER_URL = "http://127.0.0.1:8765/sse"


async def main() -> None:
    async with Client(SERVER_URL) as client:
        res = await client.call_tool("list_tools", {})
        data = res.data if hasattr(res, "data") and res.data else res.structured_content
        tools = data.get("tools", {})
        print(f"{'TOOL':<16} {'INSTALLED':<11} PATH")
        print("-" * 80)
        for name in sorted(tools):
            info = tools[name]
            installed = "YES" if info.get("installed") else "no"
            path = info.get("path") or "—"
            print(f"{name:<16} {installed:<11} {path}")


if __name__ == "__main__":
    asyncio.run(main())
