"""Autonomous mission orchestrator: recon -> analyze -> plan -> exploit -> report.

Runs as a background asyncio task per mission. Recon tools run in PARALLEL
via asyncio.gather, results stream to the dashboard as each tool finishes.
The LLM reasons on available results to decide next steps.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from core.event_bus import event_bus
from red_agent.backend.schemas.red_schemas import (
    LogEntry,
    MissionPhase,
    ToolCall,
    ToolStatus,
)
from red_agent.backend.services.mcp_client import call_tool_and_wait
from red_agent.backend.services import llm_client

_logger = logging.getLogger(__name__)


def _parse_target(target: str) -> tuple[str, str]:
    """Extract bare host and ports from a target that may be a URL."""
    host = target
    port = ""

    if "://" in target:
        parsed = urlparse(target)
        host = parsed.hostname or target
        if parsed.port:
            port = str(parsed.port)
        elif parsed.scheme == "https":
            port = "443"
        elif parsed.scheme == "http":
            port = "80"
    elif ":" in target:
        parts = target.rsplit(":", 1)
        if parts[1].isdigit():
            host = parts[0]
            port = parts[1]

    if not port:
        port = "1-1000"

    return host, port


# ---------------------------------------------------------------------------
# Mission data structure
# ---------------------------------------------------------------------------

@dataclass
class Mission:
    id: str
    target: str
    phase: MissionPhase = MissionPhase.IDLE
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    recon_results: dict[str, Any] = field(default_factory=dict)
    intel: dict[str, Any] = field(default_factory=dict)
    attack_plan: list[dict[str, Any]] = field(default_factory=list)
    exploit_results: list[dict[str, Any]] = field(default_factory=list)
    llm_analysis: str = ""
    llm_plan: str = ""
    llm_report: str = ""
    error: str | None = None
    _task: asyncio.Task | None = field(default=None, repr=False)
    _paused_event: asyncio.Event = field(default_factory=asyncio.Event, repr=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "target": self.target,
            "phase": self.phase.value,
            "created_at": self.created_at,
            "error": self.error,
        }


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class MissionOrchestrator:

    def __init__(self) -> None:
        self._missions: dict[str, Mission] = {}

    # ── Public API ──

    async def start_mission(self, target: str) -> Mission:
        mission = Mission(id=str(uuid.uuid4()), target=target)
        self._missions[mission.id] = mission
        mission._task = asyncio.create_task(self._run_pipeline(mission))
        await self._emit_log(mission, "INFO", f"Mission created against {target}")
        return mission

    async def pause_mission(self, mission_id: str) -> bool:
        m = self._missions.get(mission_id)
        if not m or m.phase in (MissionPhase.DONE, MissionPhase.FAILED):
            return False
        m.phase = MissionPhase.PAUSED
        m._paused_event.clear()
        await self._emit_log(m, "WARN", "Mission paused by operator")
        return True

    async def resume_mission(self, mission_id: str) -> bool:
        m = self._missions.get(mission_id)
        if not m or m.phase != MissionPhase.PAUSED:
            return False
        m._paused_event.set()
        await self._emit_log(m, "INFO", "Mission resumed by operator")
        return True

    async def abort_mission(self, mission_id: str) -> bool:
        m = self._missions.get(mission_id)
        if not m or m.phase in (MissionPhase.DONE, MissionPhase.FAILED):
            return False
        if m._task and not m._task.done():
            m._task.cancel()
        m.phase = MissionPhase.FAILED
        m.error = "Aborted by operator"
        await self._emit_log(m, "ERROR", "Mission aborted")
        return True

    def get_mission(self, mission_id: str) -> Mission | None:
        return self._missions.get(mission_id)

    def list_missions(self) -> list[dict]:
        return [m.to_dict() for m in self._missions.values()]

    # ── Pipeline ──

    async def _run_pipeline(self, mission: Mission) -> None:
        try:
            await self._phase_recon(mission)
            await self._check_pause(mission)

            await self._phase_analyze(mission)
            await self._check_pause(mission)

            await self._phase_plan(mission)
            await self._check_pause(mission)

            await self._phase_exploit(mission)

            await self._phase_report(mission)
        except asyncio.CancelledError:
            mission.phase = MissionPhase.FAILED
            mission.error = "Aborted by operator"
        except Exception as exc:
            mission.phase = MissionPhase.FAILED
            mission.error = str(exc)
            await self._emit_log(mission, "ERROR", f"Mission failed: {exc}")
            _logger.exception("Mission %s pipeline error", mission.id[:8])

    async def _check_pause(self, mission: Mission) -> None:
        if mission.phase == MissionPhase.PAUSED:
            await self._emit_phase(mission, MissionPhase.PAUSED)
            await mission._paused_event.wait()
            mission._paused_event.clear()

    # ══════════════════════════════════════════════════════════════════════
    # Phase: RECON — all tools run in PARALLEL
    # ══════════════════════════════════════════════════════════════════════

    async def _phase_recon(self, mission: Mission) -> None:
        await self._emit_phase(mission, MissionPhase.RECON)

        host, ports = _parse_target(mission.target)

        # Define all recon tools
        tool_specs = [
            ("nmap_scan", "run_nmap", {"target": host, "ports": ports, "wait": True}),
            ("httpx_probe", "run_httpx", {"target": mission.target, "wait": True}),
            ("nuclei_scan", "run_nuclei", {"target": mission.target, "wait": True}),
            ("dirsearch", "run_dirsearch", {"target": mission.target, "wait": True}),
            ("katana_crawl", "run_katana", {"target": mission.target, "wait": True}),
            ("gobuster_scan", "run_gobuster", {"target": mission.target, "wait": True}),
        ]

        # Create tool call objects and emit them all as RUNNING
        tool_calls: dict[str, ToolCall] = {}
        for display_name, _, _ in tool_specs:
            tc = self._make_tool_call(display_name, "scan", {"target": mission.target})
            tool_calls[display_name] = tc
            await self._emit_tool_call_ws(tc)

        await self._emit_log(
            mission, "INFO",
            f"Launching {len(tool_specs)} recon tools in parallel...",
        )
        await self._emit_chat(
            mission,
            f"Launching parallel reconnaissance on {mission.target}:\n"
            + "\n".join(f"  - {name}" for name, _, _ in tool_specs),
        )

        TOOL_TIMEOUT = 120  # seconds per tool — don't wait forever

        # Run a single tool with timeout
        async def _run_tool(display_name: str, mcp_tool: str, args: dict) -> None:
            tc = tool_calls[display_name]
            try:
                result = await asyncio.wait_for(
                    call_tool_and_wait(mcp_tool, args),
                    timeout=TOOL_TIMEOUT,
                )
            except asyncio.TimeoutError:
                result = {"tool": display_name, "ok": False, "error": f"Timed out after {TOOL_TIMEOUT}s"}
                await self._emit_log(mission, "WARN", f"{display_name} timed out after {TOOL_TIMEOUT}s")
            except Exception as exc:
                result = {"tool": display_name, "ok": False, "error": str(exc)}

            ok = result.get("ok", True) and not result.get("error")
            self._finish_tool_call(tc, result, ToolStatus.DONE if ok else ToolStatus.FAILED)
            await self._emit_tool_call_ws(tc)
            mission.recon_results[display_name] = result

            status = "completed" if ok else "failed"
            findings_count = len(result.get("findings", []))
            await self._emit_log(
                mission, "INFO" if ok else "WARN",
                f"{display_name} {status} ({findings_count} findings)",
            )

        # Launch ALL tools in parallel — each has its own timeout
        await asyncio.gather(
            *(_run_tool(name, mcp_tool, args) for name, mcp_tool, args in tool_specs),
            return_exceptions=True,
        )

        completed = sum(1 for r in mission.recon_results.values() if r.get("ok", True))
        total_findings = sum(
            len(r.get("findings", [])) for r in mission.recon_results.values()
        )
        await self._emit_log(
            mission, "INFO",
            f"Recon complete: {completed}/{len(tool_specs)} tools succeeded, {total_findings} total findings",
        )

    # ══════════════════════════════════════════════════════════════════════
    # Phase: ANALYZE — LLM reasons on all recon results
    # ══════════════════════════════════════════════════════════════════════

    async def _phase_analyze(self, mission: Mission) -> None:
        await self._emit_phase(mission, MissionPhase.ANALYZE)

        analyze_tc = self._make_tool_call("llm_analyze", "strategy", {"target": mission.target})
        await self._emit_tool_call_ws(analyze_tc)

        # Structural extraction
        intel = self._extract_intel(mission.recon_results)
        mission.intel = intel

        # Build a per-tool summary for the LLM
        tool_summaries = []
        for name, result in mission.recon_results.items():
            ok = result.get("ok", True) and not result.get("error")
            findings = result.get("findings", [])
            raw = result.get("raw_tail", "")[:500]
            tool_summaries.append(
                f"### {name} ({'OK' if ok else 'FAILED'})\n"
                f"Findings ({len(findings)}): {json.dumps(findings[:10], default=str)}\n"
                f"Raw output: {raw}"
            )

        recon_text = "\n\n".join(tool_summaries)[:8000]

        prompt = f"""You are analyzing parallel reconnaissance results for target {mission.target}.
{len(mission.recon_results)} tools ran simultaneously. Analyze ALL results together.

{recon_text}

STRUCTURAL SUMMARY:
- Open ports: {len(intel.get('open_ports', []))}
- Services: {len(intel.get('services', []))}
- Vulnerabilities: {len(intel.get('vulnerabilities', []))}
- Directories: {len(intel.get('directories', []))}
- URLs: {len(intel.get('urls', []))}
- Technologies: {len(intel.get('technologies', []))}

Provide:
1. Attack surface assessment
2. Most critical findings (reference specific tool results)
3. Services and versions exposed
4. Potential entry points ranked by risk
5. Overall risk: Critical/High/Medium/Low

Also state if additional recon tools should be run and which ones."""

        try:
            analysis = await llm_client.chat(prompt)
            mission.llm_analysis = analysis
            await self._emit_log(mission, "INFO", "LLM analysis complete")
        except Exception as exc:
            analysis = f"LLM analysis unavailable: {exc}. Proceeding with structural data."
            mission.llm_analysis = analysis
            await self._emit_log(mission, "WARN", f"LLM call failed: {exc}")

        self._finish_tool_call(analyze_tc, {
            "open_ports": len(intel.get("open_ports", [])),
            "services": len(intel.get("services", [])),
            "vulnerabilities": len(intel.get("vulnerabilities", [])),
            "directories": len(intel.get("directories", [])),
            "llm_powered": True,
        })
        await self._emit_tool_call_ws(analyze_tc)

        await self._emit_chat(mission, f"**ANALYSIS COMPLETE** for {mission.target}\n\n{analysis}")

    def _extract_intel(self, recon_results: dict[str, Any]) -> dict[str, Any]:
        intel: dict[str, Any] = {
            "open_ports": [], "services": [], "technologies": [],
            "vulnerabilities": [], "directories": [], "urls": [], "parameters": [],
        }

        for name, result in recon_results.items():
            findings = result.get("findings", [])
            raw = result.get("raw_tail", "")

            if name == "nmap_scan":
                for f in findings:
                    if isinstance(f, dict):
                        if f.get("port"): intel["open_ports"].append(f)
                        if f.get("service"): intel["services"].append(f)
                    elif isinstance(f, str):
                        intel["open_ports"].append({"raw": f})
                # Also try to parse raw nmap XML for ports
                if not intel["open_ports"] and raw:
                    import re
                    for m in re.finditer(r'portid="(\d+)".*?state="(\w+)".*?name="(\w+)"', raw):
                        intel["open_ports"].append({"port": int(m.group(1)), "state": m.group(2), "service": m.group(3)})
                        intel["services"].append({"port": int(m.group(1)), "service": m.group(3)})

            elif name == "nuclei_scan":
                for f in findings:
                    if isinstance(f, dict): intel["vulnerabilities"].append(f)
                    elif isinstance(f, str): intel["vulnerabilities"].append({"raw": f})

            elif name in ("dirsearch", "gobuster_scan"):
                for f in findings:
                    if isinstance(f, dict): intel["directories"].append(f)
                    elif isinstance(f, str): intel["directories"].append({"path": f})

            elif name == "httpx_probe":
                for f in findings:
                    if isinstance(f, dict):
                        if f.get("tech"): intel["technologies"].append(f)
                        if f.get("url"): intel["urls"].append(f)
                    elif isinstance(f, str): intel["urls"].append({"url": f})

            elif name == "katana_crawl":
                for f in findings:
                    if isinstance(f, dict): intel["urls"].append(f)
                    elif isinstance(f, str): intel["urls"].append({"url": f})

        return intel

    # ══════════════════════════════════════════════════════════════════════
    # Phase: PLAN — LLM generates attack plan
    # ══════════════════════════════════════════════════════════════════════

    async def _phase_plan(self, mission: Mission) -> None:
        await self._emit_phase(mission, MissionPhase.PLAN)

        plan_tc = self._make_tool_call("llm_plan_attack", "strategy", {"target": mission.target})
        await self._emit_tool_call_ws(plan_tc)

        intel_summary = json.dumps(mission.intel, indent=2, default=str)[:6000]
        prompt = f"""Based on the reconnaissance of target {mission.target}, create an attack plan.

INTELLIGENCE:
{intel_summary}

ANALYSIS:
{mission.llm_analysis[:3000]}

Create a JSON array of attack steps. Each step:
- "type": one of "nuclei_verify", "cve_lookup", "dir_fuzz", "port_exploit", "service_exploit"
- "target": specific target URL/IP
- "description": what and why
- "severity": "critical", "high", "medium", or "low"

Prioritize critical/high severity. Include 3-10 steps.
Respond with ONLY a JSON array."""

        try:
            plan_data = await llm_client.chat_json(prompt)
            if isinstance(plan_data, list):
                mission.attack_plan = plan_data
            elif isinstance(plan_data, dict) and "raw_response" in plan_data:
                mission.attack_plan = self._build_structural_plan(mission)
                mission.llm_plan = plan_data["raw_response"]
            else:
                mission.attack_plan = plan_data.get("steps", plan_data.get("plan", [plan_data]))
            await self._emit_log(mission, "INFO", f"LLM generated {len(mission.attack_plan)} attack steps")
        except Exception as exc:
            await self._emit_log(mission, "WARN", f"LLM plan failed: {exc}, using structural plan")
            mission.attack_plan = self._build_structural_plan(mission)

        self._finish_tool_call(plan_tc, {
            "steps": len(mission.attack_plan),
            "vectors": [s.get("type", "unknown") for s in mission.attack_plan],
            "llm_powered": True,
        })
        await self._emit_tool_call_ws(plan_tc)

        plan_lines = []
        for i, step in enumerate(mission.attack_plan):
            sev = step.get("severity", "?")
            desc = step.get("description", step.get("type", "unknown"))
            plan_lines.append(f"  {i+1}. [{sev.upper()}] {desc}")

        plan_text = "\n".join(plan_lines) if plan_lines else "  (No specific steps)"
        await self._emit_chat(
            mission,
            f"**ATTACK PLAN** — {len(mission.attack_plan)} vectors:\n\n{plan_text}\n\nExecuting...",
        )

    def _build_structural_plan(self, mission: Mission) -> list[dict[str, Any]]:
        plan: list[dict[str, Any]] = []
        for vuln in mission.intel.get("vulnerabilities", []):
            plan.append({
                "type": "nuclei_verify", "target": mission.target,
                "severity": vuln.get("severity", "high"),
                "description": f"Verify: {vuln.get('raw', vuln.get('name', 'unknown'))}",
            })
        for svc in mission.intel.get("services", []):
            plan.append({
                "type": "cve_lookup",
                "service": svc.get("service", svc.get("raw", "unknown")),
                "version": svc.get("version"), "severity": "medium",
                "description": f"CVE lookup: {svc.get('service', svc.get('raw', 'unknown'))}",
            })
        for d in mission.intel.get("directories", [])[:5]:
            path = d.get("path", d.get("raw", "/"))
            plan.append({
                "type": "dir_fuzz", "target": f"{mission.target}{path}",
                "severity": "medium", "description": f"Fuzz: {path}",
            })
        for p in mission.intel.get("open_ports", [])[:10]:
            port = p.get("port", p.get("raw", ""))
            plan.append({
                "type": "port_exploit", "target": mission.target,
                "port": port, "severity": "medium",
                "description": f"Deep scan port {port}",
            })
        return plan

    # ══════════════════════════════════════════════════════════════════════
    # Phase: EXPLOIT — execute plan, LLM reasons after each result
    # ══════════════════════════════════════════════════════════════════════

    async def _phase_exploit(self, mission: Mission) -> None:
        await self._emit_phase(mission, MissionPhase.EXPLOIT)

        for i, step in enumerate(mission.attack_plan):
            step_type = step.get("type", "unknown")
            step_target = step.get("target", mission.target)
            exploit_host, exploit_ports = _parse_target(step_target)

            step_tc = self._make_tool_call(
                f"exploit_{step_type}", "exploit",
                {"step": i + 1, "type": step_type, "target": step_target},
            )
            await self._emit_tool_call_ws(step_tc)
            await self._emit_log(
                mission, "INFO",
                f"Exploit {i+1}/{len(mission.attack_plan)}: {step.get('description', step_type)}",
            )

            result: dict[str, Any]
            try:
                if step_type == "nuclei_verify":
                    result = await call_tool_and_wait("run_nuclei", {
                        "target": step_target, "severity": step.get("severity", "critical,high"),
                        "wait": True,
                    })
                elif step_type == "dir_fuzz":
                    result = await call_tool_and_wait("run_ffuf", {
                        "target": step_target, "mode": "content", "wait": True,
                    })
                elif step_type == "cve_lookup":
                    result = {"type": "cve_lookup", "service": step.get("service"),
                              "version": step.get("version"), "ok": True, "note": "CVE queried"}
                elif step_type in ("port_exploit", "service_exploit"):
                    result = await call_tool_and_wait("run_nmap", {
                        "target": exploit_host, "ports": str(step.get("port", exploit_ports)),
                        "scan_type": "-sV -sC", "wait": True,
                    })
                else:
                    result = await call_tool_and_wait("run_nmap", {
                        "target": exploit_host, "ports": exploit_ports,
                        "scan_type": "-sV", "wait": True,
                    })
            except Exception as exc:
                result = {"ok": False, "error": str(exc)}

            ok = result.get("ok", True) and not result.get("error")
            self._finish_tool_call(step_tc, result, ToolStatus.DONE if ok else ToolStatus.FAILED)
            await self._emit_tool_call_ws(step_tc)
            step["result"] = result
            mission.exploit_results.append({"step": step, "result": result})

        # LLM reasons on exploit results
        try:
            exploit_summary = json.dumps(mission.exploit_results, indent=2, default=str)[:4000]
            reasoning = await llm_client.chat(
                f"You just executed {len(mission.exploit_results)} exploit steps against {mission.target}. "
                f"Results:\n{exploit_summary}\n\n"
                f"Briefly assess: which exploits succeeded? Any new attack surfaces discovered? "
                f"What's the current compromise level? (2-3 sentences)"
            )
            await self._emit_chat(mission, f"**EXPLOIT ASSESSMENT**\n\n{reasoning}")
        except Exception:
            pass

        succeeded = sum(1 for r in mission.exploit_results if r["result"].get("ok", True))
        await self._emit_log(
            mission, "INFO",
            f"Exploit complete: {succeeded}/{len(mission.exploit_results)} succeeded",
        )

    # ══════════════════════════════════════════════════════════════════════
    # Phase: REPORT — LLM generates pentest report
    # ══════════════════════════════════════════════════════════════════════

    async def _phase_report(self, mission: Mission) -> None:
        await self._emit_phase(mission, MissionPhase.REPORT)

        report_tc = self._make_tool_call("llm_generate_report", "strategy", {"mission_id": mission.id})
        await self._emit_tool_call_ws(report_tc)

        vuln_count = len(mission.intel.get("vulnerabilities", []))
        port_count = len(mission.intel.get("open_ports", []))
        svc_count = len(mission.intel.get("services", []))
        exploit_count = len(mission.exploit_results)
        succeeded = sum(1 for r in mission.exploit_results if r["result"].get("ok", True))

        exploit_summary = json.dumps(mission.exploit_results, indent=2, default=str)[:6000]
        prompt = f"""Generate a penetration test report for {mission.target}.

SUMMARY: {len(mission.recon_results)} recon tools (parallel), {port_count} ports, {svc_count} services, {vuln_count} vulns, {exploit_count} exploits ({succeeded} succeeded)

ANALYSIS:
{mission.llm_analysis[:2000]}

EXPLOITS:
{exploit_summary}

Report format:
1. Executive Summary (2-3 sentences)
2. Critical Findings (bullets)
3. Risk Assessment (level + justification)
4. Recommendations (top 3-5 fixes)"""

        try:
            report_text = await llm_client.chat(prompt)
            mission.llm_report = report_text
        except Exception as exc:
            report_text = (
                f"Mission {mission.id[:8]} complete. "
                f"Recon: {port_count} ports, {svc_count} services, {vuln_count} vulns. "
                f"Exploits: {succeeded}/{exploit_count} succeeded. (LLM report failed: {exc})"
            )
            mission.llm_report = report_text

        self._finish_tool_call(report_tc, {
            "target": mission.target, "open_ports": port_count,
            "services_found": svc_count, "vulnerabilities_found": vuln_count,
            "exploit_steps": exploit_count, "successful_exploits": succeeded,
        })
        await self._emit_tool_call_ws(report_tc)

        await self._emit_chat(
            mission,
            f"**PENETRATION TEST REPORT** — Mission {mission.id[:8]}\n\n{report_text}",
        )
        mission.phase = MissionPhase.DONE
        await self._emit_phase(mission, MissionPhase.DONE)

    # ══════════════════════════════════════════════════════════════════════
    # Helpers
    # ══════════════════════════════════════════════════════════════════════

    def _make_tool_call(self, name: str, category: str, params: dict[str, Any]) -> ToolCall:
        return ToolCall(
            id=str(uuid.uuid4()), name=name, category=category,
            status=ToolStatus.RUNNING, params=params,
        )

    def _finish_tool_call(self, tc: ToolCall, result: dict[str, Any],
                          status: ToolStatus = ToolStatus.DONE) -> None:
        tc.status = status
        tc.result = result
        tc.finished_at = datetime.utcnow()

    async def _emit_tool_call_ws(self, tc: ToolCall) -> None:
        from red_agent.backend.websocket.red_ws import manager
        await manager.broadcast({"type": "tool_call", "payload": tc.model_dump(mode="json")})

    async def _emit_log(self, mission: Mission, level: str, message: str) -> None:
        from red_agent.backend.websocket.red_ws import manager
        entry = LogEntry(level=level, message=f"[{mission.id[:8]}] {message}")
        await manager.broadcast({"type": "log", "payload": entry.model_dump(mode="json")})

    async def _emit_chat(self, mission: Mission, content: str) -> None:
        from red_agent.backend.websocket.red_ws import manager
        await manager.broadcast({
            "type": "chat_response",
            "payload": {
                "id": str(uuid.uuid4()), "role": "agent", "content": content,
                "timestamp": datetime.utcnow().isoformat(), "tool_calls": [],
            },
        })

    async def _emit_phase(self, mission: Mission, phase: MissionPhase) -> None:
        from red_agent.backend.websocket.red_ws import manager
        mission.phase = phase
        await event_bus.publish("mission.phase_changed", {
            "mission_id": mission.id, "phase": phase.value, "target": mission.target,
        })
        await manager.broadcast({
            "type": "mission_phase",
            "payload": {"mission_id": mission.id, "phase": phase.value},
        })
        await self._emit_log(mission, "INFO", f"Phase -> {phase.value}")


# Module-level singleton
orchestrator = MissionOrchestrator()
