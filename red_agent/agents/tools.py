"""CrewAI Tool wrappers — each tool broadcasts start/finish to the dashboard.

Every tool call appears as a card in the Activity Panel with:
- Tool name
- Which agent called it
- Status (RUNNING → DONE/FAILED)
- Results
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time as _time
import uuid
from datetime import datetime
from urllib.parse import urlparse

try:
    from crewai.tools import tool
except ImportError:
    def tool(func=None, **_):  # type: ignore
        if func is None or isinstance(func, str):
            return lambda f: f
        return func

_logger = logging.getLogger(__name__)

# ── Shared state ──
_current_agent: str = "recon"

# Each tool belongs to exactly one logical agent — derive the dashboard
# label from this map instead of the volatile _current_agent global.
_TOOL_AGENT: dict[str, str] = {
    "nmap_scan": "Recon Specialist",
    "httpx_probe": "Recon Specialist",
    "gobuster_scan": "Recon Specialist",
    "nuclei_scan": "Recon Specialist",
    "katana_crawl": "Recon Specialist",
    "dirsearch_scan": "Recon Specialist",
    "sqlmap_detect": "Recon Specialist",
    "sqlmap_dbs": "Exploit Specialist",
    "sqlmap_tables": "Exploit Specialist",
    "sqlmap_dump": "Exploit Specialist",
    "nuclei_exploit": "Exploit Specialist",
    "ffuf_fuzz": "Exploit Specialist",
    "nmap_vuln_scan": "Exploit Specialist",
}

# Latest result per tool name — grounding source for chat LLM
_RECENT_TOOL_RESULTS: dict[str, dict] = {}

# Dedupe identical in-flight calls within 60s
_INFLIGHT_RESULTS: dict[str, tuple[float, str]] = {}
_DEDUP_WINDOW_S = 60.0

# SQLi-confirmed URLs pending auto-pwn
_INJECTABLE_URLS: list[dict] = []
_AUTO_PWN_FIRED: set[str] = set()


def get_recent_tool_results() -> dict[str, dict]:
    return dict(_RECENT_TOOL_RESULTS)


def clear_recent_tool_results() -> None:
    _RECENT_TOOL_RESULTS.clear()
    _INJECTABLE_URLS.clear()
    _AUTO_PWN_FIRED.clear()
    _INFLIGHT_RESULTS.clear()


def drain_injectable_urls() -> list[dict]:
    out = [u for u in _INJECTABLE_URLS if u.get("url") not in _AUTO_PWN_FIRED]
    _INJECTABLE_URLS.clear()
    for u in out:
        if u.get("url"):
            _AUTO_PWN_FIRED.add(u["url"])
    return out


def _dedup_key(tool_name: str, args: dict) -> str:
    try:
        return f"{tool_name}:{json.dumps(args, sort_keys=True, default=str)}"
    except Exception:
        return f"{tool_name}:{args!r}"


def set_active_agent(name: str) -> None:
    global _current_agent
    _current_agent = name


def _host_only(target: str) -> str:
    if "://" in target:
        parsed = urlparse(target)
        return parsed.hostname or target
    return target.split("/", 1)[0]


_COMMON_PORTS = "21,22,80,443,3000,3306,5000,5432,6379,8000,8080,8443,8888,9000,27017"


def _get_port(target: str) -> str:
    if "://" in target:
        parsed = urlparse(target)
        if parsed.port:
            return str(parsed.port)
        return "443" if parsed.scheme == "https" else "80"
    if ":" in target and not target.count(".") >= 3:
        parts = target.rsplit(":", 1)
        if parts[1].isdigit():
            return parts[1]
    if target.count(":") == 1:
        parts = target.rsplit(":", 1)
        if parts[1].isdigit():
            return parts[1]
    return _COMMON_PORTS


# ── Injectable URL extraction ──

_FORM_URL_RE = re.compile(r"(?:GET|POST)\s+(https?://[^\s\"'<>]+)", re.IGNORECASE)


def _extract_injectable_url(raw_output: str, base_target: str, param: str) -> str:
    if not raw_output:
        return base_target
    candidates = [u.rstrip(",.;:)") for u in _FORM_URL_RE.findall(raw_output)]
    if param:
        for url in candidates:
            if f"?{param}=" in url or f"&{param}=" in url:
                return url
    if candidates:
        return candidates[0]
    return base_target


def _record_injectable(target: str, findings: list, raw_output: str = "") -> None:
    if not findings:
        return
    dbms = None
    has_injection = False
    params: list[str] = []
    for f in findings:
        if not isinstance(f, dict):
            continue
        if f.get("type") == "injection":
            has_injection = True
            p = f.get("param")
            if p and p not in params:
                params.append(p)
        elif f.get("type") == "dbms":
            dbms = f.get("value")
    if has_injection:
        primary = params[0] if params else ""
        actual = _extract_injectable_url(raw_output, target, primary)
        _INJECTABLE_URLS.append({"url": actual, "dbms": dbms, "params": params})
        _fire_auto_pwn(actual, dbms=dbms)


def _fire_auto_pwn(url: str, dbms: str | None = None) -> None:
    if not url or url in _AUTO_PWN_FIRED:
        return
    try:
        from red_agent.backend.websocket.red_ws import manager
        from red_agent.backend.services.auto_pwn import auto_sqli_pipeline
    except Exception as exc:
        _logger.warning("auto_pwn fire-on-detect unavailable: %s", exc)
        return

    loop = manager._main_loop
    if not loop or not loop.is_running():
        return

    _AUTO_PWN_FIRED.add(url)
    asyncio.run_coroutine_threadsafe(auto_sqli_pipeline(url, dbms=dbms), loop)
    _logger.info("[tools] auto_pwn fired on detection -> %s (dbms=%s)", url, dbms)


# ── WebSocket broadcasting ──

def _broadcast_tool_event(
    tool_name: str,
    status: str,
    category: str,
    params: dict,
    result: dict | None = None,
    *,
    call_id: str | None = None,
) -> None:
    try:
        from red_agent.backend.websocket.red_ws import manager
        from red_agent.backend.schemas.red_schemas import ToolCall, ToolStatus

        tc = ToolCall(
            id=call_id or str(uuid.uuid4()),
            name=tool_name,
            category=category,
            status=ToolStatus(status),
            params=params,
            result=result,
            finished_at=datetime.utcnow() if status in ("DONE", "FAILED") else None,
        )
        if status in ("DONE", "FAILED") and result is not None:
            _RECENT_TOOL_RESULTS[tool_name] = {
                "status": status,
                "result": result,
                "params": params,
                "finished_at": datetime.utcnow().isoformat(),
            }

        payload = {"type": "tool_call", "payload": tc.model_dump(mode="json")}
        manager.broadcast_threadsafe(payload)
    except Exception as e:
        _logger.warning("Failed to broadcast tool event: %s", e)


def _broadcast_chat(content: str) -> None:
    try:
        from red_agent.backend.websocket.red_ws import manager
        import uuid as _uuid
        from datetime import datetime as _dt

        payload = {
            "type": "chat_response",
            "payload": {
                "id": str(_uuid.uuid4()),
                "role": "agent",
                "content": content,
                "timestamp": _dt.utcnow().isoformat(),
                "tool_calls": [],
            },
        }
        manager.broadcast_threadsafe(payload)
    except Exception as e:
        _logger.warning("Failed to broadcast chat: %s", e)


def _broadcast_log(level: str, message: str) -> None:
    try:
        from red_agent.backend.websocket.red_ws import manager
        from red_agent.backend.schemas.red_schemas import LogEntry

        entry = LogEntry(level=level, message=message)
        payload = {"type": "log", "payload": entry.model_dump(mode="json")}
        manager.broadcast_threadsafe(payload)
    except Exception as e:
        _logger.warning("Failed to broadcast log: %s", e)


# ── Simulation fallback (Windows-safe when Kali MCP is unavailable) ──

def _mcp_available() -> bool:
    try:
        from red_agent.backend.services.mcp_client import Client  # noqa: F401
        return Client is not None
    except Exception:
        return False


def _simulated_result(tool_name: str, target: str) -> dict:
    host = _host_only(target)
    if tool_name == "nmap_scan":
        return {
            "ok": True, "findings": [
                {"port": 22,   "state": "open", "service": "ssh",   "product": "OpenSSH",  "version": "8.9p1"},
                {"port": 80,   "state": "open", "service": "http",  "product": "nginx",    "version": "1.24.0"},
                {"port": 5000, "state": "open", "service": "http",  "product": "Werkzeug", "version": "2.3.0"},
                {"port": 3306, "state": "open", "service": "mysql", "product": "MySQL",    "version": "8.0.33"},
            ],
            "note": "MCP/Kali unavailable — simulated nmap output",
        }
    if tool_name in ("nuclei_scan", "nuclei_exploit"):
        return {
            "ok": True, "findings": [
                {"template": "CVE-2021-41773", "severity": "critical", "host": host, "name": "Apache Path Traversal"},
                {"template": "exposed-panels",  "severity": "high",    "host": host, "name": "Admin panel exposed at /admin"},
                {"template": "sqli-error-based","severity": "high",    "host": host, "name": "SQL injection on /login"},
            ],
            "note": "MCP/Kali unavailable — simulated nuclei output",
        }
    if tool_name in ("gobuster_scan", "dirsearch_scan", "ffuf_fuzz"):
        return {
            "ok": True, "findings": [
                {"path": "/admin",      "status": 200, "size": 4321},
                {"path": "/login",      "status": 200, "size": 2048},
                {"path": "/api/users",  "status": 200, "size": 812},
                {"path": "/api/data",   "status": 200, "size": 1536},
                {"path": "/.env",       "status": 200, "size": 237},
                {"path": "/config.php", "status": 200, "size": 512},
            ],
            "note": "MCP/Kali unavailable — simulated directory scan output",
        }
    if tool_name in ("httpx_probe", "katana_crawl"):
        return {
            "ok": True, "findings": [
                {"url": f"http://{host}", "status": 200, "tech": ["nginx", "Python", "Flask"], "title": "Web Application"},
                {"url": f"http://{host}/login", "status": 200, "forms": [{"action": "/login", "inputs": ["username", "password"]}]},
            ],
            "note": "MCP/Kali unavailable — simulated probe output",
        }
    if tool_name == "sqlmap_detect":
        return {
            "ok": True, "findings": [
                {"type": "injection", "param": "username", "technique": "error-based"},
                {"type": "dbms", "value": "MySQL 8.0"},
            ],
            "note": "MCP/Kali unavailable — simulated sqlmap detection",
        }
    if tool_name == "sqlmap_dbs":
        return {
            "ok": True, "findings": [
                {"type": "database", "name": "webapp_db"},
                {"type": "database", "name": "information_schema"},
            ],
            "note": "MCP/Kali unavailable — simulated sqlmap_dbs",
        }
    if tool_name == "sqlmap_tables":
        return {
            "ok": True, "findings": [
                {"type": "table", "name": "users"},
                {"type": "table", "name": "sessions"},
                {"type": "table", "name": "products"},
            ],
            "note": "MCP/Kali unavailable — simulated sqlmap_tables",
        }
    if tool_name == "sqlmap_dump":
        return {
            "ok": True, "findings": [
                {"id": 1, "username": "admin", "password": "5f4dcc3b5aa765d61d8327deb882cf99", "email": "admin@lab.local"},
                {"id": 2, "username": "user1", "password": "d8578edf8458ce06fbc5bb76a58c5ca4", "email": "user1@lab.local"},
            ],
            "note": "MCP/Kali unavailable — simulated sqlmap_dump",
        }
    return {"ok": True, "findings": [], "note": f"MCP/Kali unavailable — no simulation for {tool_name}"}


# ── Core MCP runner ──

def _run_mcp_tool(
    tool_name: str,
    mcp_name: str,
    args: dict,
    category: str = "scan",
    *,
    findings_cap: int = 10,
    raw_cap: int = 500,
    return_cap: int = 4000,
) -> str:
    agent = _TOOL_AGENT.get(tool_name, _current_agent)
    params = {"target": args.get("target", ""), "agent": agent}

    # Dedupe duplicate calls
    key = _dedup_key(tool_name, args)
    now = _time.time()
    cached = _INFLIGHT_RESULTS.get(key)
    if cached and (now - cached[0]) < _DEDUP_WINDOW_S:
        _broadcast_log("WARN", f"[{agent}] {tool_name} deduped — returning cached result")
        return cached[1]

    call_id = str(uuid.uuid4())
    _broadcast_tool_event(tool_name, "RUNNING", category, params, call_id=call_id)
    _broadcast_log("INFO", f"[{agent}] {tool_name} started")

    # Try real MCP first, fall back to simulation
    if _mcp_available():
        try:
            from red_agent.backend.services.mcp_client import call_tool_and_wait
            result = asyncio.run(call_tool_and_wait(mcp_name, args))
        except Exception as e:
            _logger.warning("[%s] MCP call failed (%s), using simulation", tool_name, e)
            result = _simulated_result(tool_name, args.get("target", ""))
    else:
        _logger.info("[%s] MCP not available — using simulated results", tool_name)
        result = _simulated_result(tool_name, args.get("target", ""))

    findings = result.get("findings", [])
    ok = result.get("ok", True) and not result.get("error")
    status = "DONE" if ok else "FAILED"
    is_simulated = "note" in result and "simulated" in str(result.get("note", ""))

    broadcast_result = {
        "ok": ok,
        "findings_count": len(findings),
        "findings": findings[:findings_cap],
        "duration": result.get("duration_s", 0),
        "agent": agent,
        "simulated": is_simulated,
    }
    if result.get("error"):
        broadcast_result["error"] = str(result["error"])[:200]
    raw = result.get("raw_tail", "")
    if raw:
        broadcast_result["raw_output"] = raw[:raw_cap]
    for meta_key in ("mode", "db", "table", "dump_all"):
        if meta_key in result:
            broadcast_result[meta_key] = result[meta_key]

    _broadcast_tool_event(tool_name, status, category, params, broadcast_result, call_id=call_id)

    sim_tag = " [simulated]" if is_simulated else ""
    detail = ""
    if findings:
        first = findings[0]
        if isinstance(first, dict):
            port = first.get("port", "")
            service = first.get("service", "")
            state = first.get("state", "")
            if port:
                detail = f" — port {port}/{service} ({state})"
            else:
                detail = f" — {json.dumps(first, default=str)[:80]}"
    if not ok and result.get("error"):
        detail = f" — {str(result['error'])[:160]}"
    _broadcast_log(
        "INFO" if ok else "WARN",
        f"[{agent}] {tool_name} {'completed' if ok else 'failed'}{sim_tag} — {len(findings)} findings{detail}",
    )

    if findings:
        ret = json.dumps(findings[:findings_cap], indent=2, default=str)[:return_cap]
    elif raw:
        ret = f"{tool_name} output:\n{raw[:return_cap]}"
    else:
        ret = json.dumps(result, default=str)[:return_cap]

    _INFLIGHT_RESULTS[key] = (now, ret)
    return ret


# ══════════════════════════════════════════════════════════════════════
# Recon Tools
# ══════════════════════════════════════════════════════════════════════

@tool("nmap_scan")
def nmap_scan(target: str) -> str:
    """Run nmap service/version scan. Input: IP or URL. Returns open ports, services, versions."""
    host = _host_only(target)
    port = _get_port(target)
    return _run_mcp_tool("nmap_scan", "run_nmap", {
        "target": host, "ports": port,
        "scan_type": "-sV -Pn -T4 --max-retries 1 --host-timeout 90s",
        "wait": True,
    })


@tool("nuclei_scan")
def nuclei_scan(target: str) -> str:
    """Run nuclei vulnerability scanner. Input: full URL. Detects CVEs, misconfigs, exposed panels."""
    return _run_mcp_tool("nuclei_scan", "run_nuclei", {
        "target": target, "severity": "critical,high,medium", "wait": True,
    })


@tool("gobuster_scan")
def gobuster_scan(target: str) -> str:
    """Brute-force directories and files on a web server. Input: full URL."""
    return _run_mcp_tool("gobuster_scan", "run_gobuster", {
        "target": target, "wait": True,
    })


@tool("katana_crawl")
def katana_crawl(target: str) -> str:
    """Crawl a website to discover endpoints, forms, and links. Input: full URL."""
    return _run_mcp_tool("katana_crawl", "run_katana", {
        "target": target, "wait": True,
    })


@tool("dirsearch_scan")
def dirsearch_scan(target: str) -> str:
    """Directory and file discovery on web servers. Input: full URL."""
    return _run_mcp_tool("dirsearch_scan", "run_dirsearch", {
        "target": target, "wait": True,
    })


@tool("httpx_probe")
def httpx_probe(target: str) -> str:
    """Probe web server for technology stack, status codes, headers. Input: URL or domain."""
    return _run_mcp_tool("httpx_probe", "run_httpx", {
        "target": target, "wait": True,
    })


# ══════════════════════════════════════════════════════════════════════
# Exploit Tools
# ══════════════════════════════════════════════════════════════════════

@tool("nuclei_exploit")
def nuclei_exploit(target: str) -> str:
    """Run nuclei with exploit templates to verify vulnerabilities. Input: full URL."""
    return _run_mcp_tool("nuclei_exploit", "run_nuclei", {
        "target": target, "severity": "critical,high", "tags": "cve,exploit,rce", "wait": True,
    }, category="exploit")


@tool("ffuf_fuzz")
def ffuf_fuzz(target: str) -> str:
    """Fuzz web endpoints for hidden parameters and paths. Input: base URL."""
    return _run_mcp_tool("ffuf_fuzz", "run_ffuf", {
        "target": target, "mode": "content", "wait": True,
    }, category="exploit")


@tool("nmap_vuln_scan")
def nmap_vuln_scan(target: str) -> str:
    """Run nmap with vulnerability scripts. Input: IP or hostname."""
    host = _host_only(target)
    port = _get_port(target)
    return _run_mcp_tool("nmap_vuln_scan", "run_nmap", {
        "target": host, "ports": port, "scan_type": "-sV --script=vuln", "wait": True,
    }, category="exploit")


# ══════════════════════════════════════════════════════════════════════
# SQL Injection Tools (sqlmap)
# ══════════════════════════════════════════════════════════════════════

@tool("sqlmap_detect")
def sqlmap_detect(target: str) -> str:
    """Crawl the target URL and detect SQL injection in any parameter or form.
    Input: full URL (e.g. http://victim:5000/login). Returns injectable params + DBMS fingerprint."""
    out = _run_mcp_tool("sqlmap_detect", "run_sqlmap_detect", {
        "target": target, "level": 2, "risk": 2, "crawl": 2, "wait": True,
    }, category="scan", findings_cap=20, raw_cap=8000, return_cap=4000)
    cached = _RECENT_TOOL_RESULTS.get("sqlmap_detect", {}).get("result", {})
    _record_injectable(
        target,
        cached.get("findings", []),
        cached.get("raw_output", ""),
    )
    return out


@tool("sqlmap_dbs")
def sqlmap_dbs(target: str) -> str:
    """List databases on a SQLi-vulnerable URL. Run this AFTER sqlmap_detect confirms injection.
    Input: the same URL that was confirmed injectable."""
    return _run_mcp_tool("sqlmap_dbs", "run_sqlmap_dbs", {
        "target": target, "level": 2, "risk": 2, "wait": True,
    }, category="exploit", findings_cap=50, raw_cap=4000, return_cap=4000)


@tool("sqlmap_tables")
def sqlmap_tables(target: str, db: str) -> str:
    """List tables in a specific database. Inputs: URL, db name (from sqlmap_dbs output)."""
    return _run_mcp_tool("sqlmap_tables", "run_sqlmap_tables", {
        "target": target, "db": db, "level": 2, "risk": 2, "wait": True,
    }, category="exploit", findings_cap=100, raw_cap=4000, return_cap=4000)


@tool("sqlmap_dump")
def sqlmap_dump(target: str, db: str = "", table: str = "", dump_all: bool = False) -> str:
    """Dump table contents (exfiltrate data). Pass dump_all=True to dump every table in every non-system db.
    Inputs: URL, optional db name, optional table name, optional dump_all flag."""
    return _run_mcp_tool("sqlmap_dump", "run_sqlmap_dump", {
        "target": target,
        "db": db or None,
        "table": table or None,
        "dump_all": dump_all,
        "level": 2, "risk": 2, "wait": True,
    }, category="exploit", findings_cap=500, raw_cap=16000, return_cap=8000)
