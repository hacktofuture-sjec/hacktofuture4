"""End-to-end smoke test for the Red Arsenal MCP server.

Runs from the Windows host against the Kali VM (via VirtualBox NAT port
forward to 127.0.0.1:8765). For every registered tool it:
  1. kicks off the tool against a safe target,
  2. polls job_status until done,
  3. fetches job_result,
  4. prints PASS / FAIL and a short excerpt of findings.

Targets are chosen to be non-harmful:
  - scanme.nmap.org is Nmap's public sandbox host,
  - http://scanme.nmap.org for web tools,
  - 127.0.0.1/32 for local network tools.

Usage:
    python red_agent/red_arsenal/tests/smoke_test.py
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from typing import Any

from fastmcp import Client

SERVER_URL = "http://127.0.0.1:8765/sse"

WEB_TARGET = "http://scanme.nmap.org"
HOST_TARGET = "scanme.nmap.org"
CIDR_TARGET = "127.0.0.1/32"
SMB_TARGET = "127.0.0.1"

POLL_INTERVAL = 2.0
POLL_TIMEOUT = 300.0

# (tool_name, args) tuples. Ordering is recon → api → network.
TOOL_SUITE: list[tuple[str, dict[str, Any]]] = [
    # Recon
    ("run_nmap",          {"target": HOST_TARGET, "ports": "22,80,443"}),
    ("run_httpx",         {"target": WEB_TARGET}),
    ("run_katana",        {"target": WEB_TARGET, "depth": 1}),
    ("run_gau",           {"target": HOST_TARGET}),
    ("run_waybackurls",   {"target": HOST_TARGET}),
    # Restrictive severity keeps nuclei under a minute on a clean target.
    # `tags` would be even tighter but severity=critical has zero hits on
    # scanme.nmap.org and finishes in ~30s.
    ("run_nuclei",        {"target": WEB_TARGET, "severity": "critical"}),
    ("run_dirsearch",     {"target": WEB_TARGET, "threads": 10}),
    ("run_gobuster",      {"target": WEB_TARGET}),
    # API
    ("run_arjun",         {"target": WEB_TARGET}),
    ("run_x8",            {"target": WEB_TARGET}),
    ("run_paramspider",   {"target": HOST_TARGET}),
    ("run_ffuf",          {"target": WEB_TARGET + "/FUZZ"}),
    # Network
    ("run_arp_scan",      {"local_network": True}),
    ("run_rustscan",      {"target": HOST_TARGET}),
    ("run_nmap_advanced", {"target": HOST_TARGET}),
    ("run_masscan",       {"target": HOST_TARGET, "ports": "80,443", "rate": 500}),
    ("run_enum4linux_ng", {"target": SMB_TARGET}),
    ("run_nbtscan",       {"target": SMB_TARGET}),
    ("run_smbmap",        {"target": SMB_TARGET}),
    ("run_rpcclient",     {"target": SMB_TARGET}),
]


def _short(obj: Any, limit: int = 300) -> str:
    s = json.dumps(obj, default=str)
    return s if len(s) <= limit else s[:limit] + "…"


async def _run_one(client: Client, tool: str, args: dict) -> dict:
    """Submit a tool call, poll until done, return the result dict."""
    submit_res = await client.call_tool(tool, args)
    submit = _structured(submit_res)
    job_id = submit.get("job_id")
    if not job_id:
        return submit  # inline or error

    deadline = time.monotonic() + POLL_TIMEOUT
    while time.monotonic() < deadline:
        status_res = await client.call_tool("job_status", {"job_id": job_id})
        status = _structured(status_res)
        if status.get("status") in ("done", "error"):
            break
        await asyncio.sleep(POLL_INTERVAL)
    else:
        return {"ok": False, "error": f"poll timeout after {POLL_TIMEOUT}s"}

    result_res = await client.call_tool("job_result", {"job_id": job_id, "wait": True})
    return _structured(result_res)


def _structured(res: Any) -> dict:
    """fastmcp's Client returns a CallToolResult; pull structured content."""
    if hasattr(res, "data") and res.data is not None:
        return res.data
    if hasattr(res, "structured_content") and res.structured_content is not None:
        return res.structured_content
    if hasattr(res, "content"):
        for item in res.content:
            text = getattr(item, "text", None)
            if text:
                try:
                    return json.loads(text)
                except (json.JSONDecodeError, TypeError):
                    return {"raw": text}
    return {"raw": repr(res)}


async def main() -> int:
    print(f"[*] Connecting to {SERVER_URL}")
    failures = 0
    async with Client(SERVER_URL) as client:
        # Discovery
        tools = await client.list_tools()
        tool_names = [t.name for t in tools]
        print(f"[+] Server advertises {len(tool_names)} tools")

        # Sanity calls
        ping = _structured(await client.call_tool("ping", {}))
        print(f"    ping: {ping}")

        stats = _structured(await client.call_tool("server_stats", {}))
        print(f"    server_stats: {_short(stats)}")

        listed = _structured(await client.call_tool("list_tools", {}))
        installed = {
            k: v for k, v in listed.get("tools", {}).items() if v.get("installed")
        }
        print(f"    installed binaries: {sorted(installed.keys())}")

        print()
        print("=" * 72)
        print(f"{'TOOL':<22} {'STATUS':<8} {'TIME':>8}  {'FINDINGS':>9}  NOTES")
        print("-" * 72)

        for tool, args in TOOL_SUITE:
            if tool not in tool_names:
                print(f"{tool:<22} SKIP     {'-':>8}  {'-':>9}  not registered")
                continue
            t0 = time.monotonic()
            try:
                result = await _run_one(client, tool, args)
            except Exception as exc:
                elapsed = time.monotonic() - t0
                print(f"{tool:<22} ERROR    {elapsed:>7.1f}s  {'-':>9}  {type(exc).__name__}: {exc}")
                failures += 1
                continue
            elapsed = time.monotonic() - t0
            ok = bool(result.get("ok"))
            findings = len(result.get("findings") or [])
            note = ""
            if not ok:
                note = (result.get("error") or "")[:80]
                failures += 1
            elif findings == 0:
                note = "no findings (tool ok)"
            else:
                note = f"first={_short(result.get('findings')[0], 80)}"
            status = "PASS" if ok else "FAIL"
            print(f"{tool:<22} {status:<8} {elapsed:>7.1f}s  {findings:>9}  {note}")

        print("-" * 72)
        print(f"Done. failures={failures}/{len(TOOL_SUITE)}")
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\n[!] interrupted")
        sys.exit(130)
