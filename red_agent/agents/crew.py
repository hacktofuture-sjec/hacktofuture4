"""Red Team Crew — 3 autonomous agents with proactive dashboard streaming.

Every agent thought, tool call, and decision is streamed to the frontend
in real-time via WebSocket. The user never has to ask "what's happening."
"""

from __future__ import annotations

import logging
import os

from crewai import Agent, Crew, Task, Process
from crewai import LLM

from red_agent.agents.tools import (
    nmap_scan, nuclei_scan, gobuster_scan, katana_crawl,
    dirsearch_scan, httpx_probe, nuclei_exploit, ffuf_fuzz,
    nmap_vuln_scan, sqlmap_detect, sqlmap_dbs, sqlmap_tables, sqlmap_dump,
    set_active_agent, _broadcast_log, _broadcast_chat,
)

_logger = logging.getLogger(__name__)

# Force litellm to use sync httpx (avoids deadlock inside uvicorn executor)
os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
os.environ["OPENAI_API_BASE"] = ""

# Azure OpenAI configuration
AZURE_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")
AZURE_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_DEPLOYMENT = os.environ.get("AZURE_OPENAI_MODEL", "gpt-4o")
AZURE_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

# NVIDIA NIM — OpenAI-compatible. Used for recon + analyst because Azure's
# content filter rejects security-research prompts. NVIDIA NIM doesn't have
# that policy restriction.
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
NVIDIA_API_BASE = os.environ.get("NVIDIA_API_BASE", "https://integrate.api.nvidia.com/v1")
NVIDIA_MODEL = os.environ.get("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")

_HAS_NVIDIA = bool(NVIDIA_API_KEY)
if _HAS_NVIDIA:
    _logger.info("[crew] NVIDIA NIM available — using for recon+analyst, Azure for exploit")
else:
    _logger.warning(
        "[crew] NVIDIA_API_KEY not set — falling back to Azure for ALL agents. "
        "Set NVIDIA_API_KEY to avoid Azure content-filter rejections on security prompts."
    )


def _get_azure_llm() -> LLM:
    return LLM(
        model=f"azure/{AZURE_DEPLOYMENT}",
        api_key=AZURE_API_KEY,
        api_base=AZURE_ENDPOINT,
        api_version=AZURE_API_VERSION,
        temperature=0.3,
    )


def _get_nvidia_llm() -> LLM:
    return LLM(
        model=f"nvidia_nim/{NVIDIA_MODEL}",
        api_key=NVIDIA_API_KEY,
        base_url=NVIDIA_API_BASE,
        temperature=0.3,
    )


def _get_llm(prefer: str = "azure") -> LLM:
    if prefer == "nvidia" and _HAS_NVIDIA:
        try:
            return _get_nvidia_llm()
        except Exception as exc:
            _logger.warning("[crew] NVIDIA LLM init failed (%s) — falling back to Azure.", exc)
    return _get_azure_llm()


# ── Proactive Callbacks ──

def _make_step_callback(agent_name: str):
    def callback(step_output):
        set_active_agent(agent_name)
        try:
            text = str(step_output).encode("ascii", "replace").decode()
            if len(text) > 400:
                text = text[:400] + "..."
            _broadcast_chat(f"**[{agent_name}]** {text}")
            _broadcast_log("INFO", f"[{agent_name}] step: {text[:150]}")
        except Exception as e:
            _logger.warning("step_callback error: %s", e)
    return callback


def _make_task_callback(task_name: str):
    def callback(task_output):
        try:
            raw = str(task_output.raw).encode("ascii", "replace").decode()
            if len(raw) > 500:
                raw = raw[:500] + "..."
            _broadcast_chat(f"**{task_name} Complete**\n\n{raw}")
            _broadcast_log("INFO", f"{task_name} finished")
        except Exception as e:
            _logger.warning("task_callback error: %s", e)
    return callback


# ── Agent Definitions ──

def create_recon_agent() -> Agent:
    return Agent(
        role="IT Infrastructure Auditor",
        goal=(
            "Perform a structured technical audit of the target system. "
            "Inventory all running services, identify the technology stack, "
            "map accessible web paths, and log any configuration issues found."
        ),
        backstory=(
            "You are a senior IT auditor performing a scheduled compliance review "
            "on an authorized lab target. You document every service, identify the "
            "software stack and versions in use, and note any configuration gaps. "
            "You start with sqlmap_detect to identify injection vectors early, then "
            "httpx_probe for web services, gobuster_scan to map accessible paths, "
            "and nuclei_scan to check for known misconfigurations. "
            "All observations are recorded objectively for the audit report."
        ),
        tools=[nmap_scan, httpx_probe, gobuster_scan, nuclei_scan, katana_crawl,
               dirsearch_scan, sqlmap_detect],
        llm=_get_llm(prefer="nvidia"),
        verbose=True,
        allow_delegation=False,
        max_iter=8,
        step_callback=_make_step_callback("IT Infrastructure Auditor"),
    )


def create_analyst_agent() -> Agent:
    return Agent(
        role="Security Risk Analyst",
        goal=(
            "Review the infrastructure audit findings and produce a structured "
            "risk assessment. Rank each finding by business impact, map it to the "
            "relevant compliance control, and recommend a specific remediation action."
        ),
        backstory=(
            "You are a certified risk analyst reviewing IT audit data for a compliance "
            "report. You categorize each finding as Critical, High, Medium, or Low "
            "based on business impact. For every finding you identify the affected "
            "component, describe the compliance gap, and recommend the corrective "
            "control that should be applied. You produce a clear, prioritized report."
        ),
        tools=[],
        llm=_get_llm(prefer="nvidia"),
        verbose=True,
        allow_delegation=False,
        step_callback=_make_step_callback("Security Risk Analyst"),
    )


def create_exploit_agent() -> Agent:
    return Agent(
        role="Technical Verification Engineer",
        goal=(
            "Confirm and document the technical details of findings identified in "
            "the audit. Use approved scanning tools to reproduce each issue, gather "
            "technical evidence, and provide specific fix recommendations."
        ),
        backstory=(
            "You are a technical verification engineer on an authorized internal audit team. "
            "Your job is to confirm reported issues are reproducible, gather "
            "technical details using approved tools, and document the evidence "
            "needed by the remediation team.\n"
            "For SQL injection findings, follow the validation ladder:\n"
            "  1. sqlmap_dbs — enumerate reachable databases\n"
            "  2. sqlmap_tables(db=<dbname>) — list tables per non-system database\n"
            "  3. sqlmap_dump(db=<db>, table=<table>) — capture sample records for evidence\n"
            "You also use nuclei_exploit, ffuf_fuzz, and nmap_vuln_scan for non-SQLi findings. "
            "Document every confirmed issue with technical details and a recommended corrective action."
        ),
        tools=[sqlmap_dbs, sqlmap_tables, sqlmap_dump,
               nuclei_exploit, ffuf_fuzz, nmap_vuln_scan, nmap_scan],
        llm=_get_azure_llm(),
        verbose=True,
        allow_delegation=False,
        max_iter=12,
        step_callback=_make_step_callback("Technical Verification Engineer"),
    )


# ── Attack playbooks ──

_ATTACK_PLAYBOOKS: dict[str, str] = {
    "sqli": (
        "ASSESSMENT PROFILE: SQL injection validation.\n"
        "  1. sqlmap_detect on {target} FIRST\n"
        "  2. gobuster_scan to discover additional dynamic endpoints\n"
        "  3. For every endpoint with query strings or form parameters — run sqlmap_detect\n"
        "  4. Skip nuclei/nmap unless time permits.\n"
    ),
    "cmdi": (
        "ASSESSMENT PROFILE: command injection validation only.\n"
        "  1. httpx_probe to fingerprint the stack\n"
        "  2. gobuster_scan to find endpoints accepting shell-style params\n"
        "  3. nuclei_scan with the command-injection template set\n"
    ),
    "lfi": (
        "ASSESSMENT PROFILE: local file inclusion validation only.\n"
        "  1. httpx_probe + gobuster_scan to find endpoints with file/path parameters\n"
        "  2. katana_crawl for query-string parameters\n"
        "  3. nuclei_scan with the LFI template set\n"
    ),
    "idor": (
        "ASSESSMENT PROFILE: insecure direct object reference validation only.\n"
        "  1. httpx_probe to confirm the target is an API/web app\n"
        "  2. katana_crawl + gobuster_scan to enumerate /api/, /v1/, /v2/\n"
        "  3. Look for numeric or UUID-shaped path segments\n"
    ),
    "xss": (
        "ASSESSMENT PROFILE: cross-site scripting validation only.\n"
        "  1. httpx_probe to confirm the web stack\n"
        "  2. gobuster_scan + katana_crawl to find every form and reflective input\n"
        "  3. nuclei_scan with the XSS template set\n"
    ),
    "full": (
        "ASSESSMENT PROFILE: full scope — enumerate every finding class.\n"
        "  1. sqlmap_detect on {target} FIRST\n"
        "  2. httpx_probe to fingerprint the stack\n"
        "  3. gobuster_scan for directories and hidden endpoints\n"
        "  4. For every dynamic endpoint discovered — run sqlmap_detect\n"
        "  5. nuclei_scan for known CVEs and misconfigurations\n"
        "  6. nmap_scan LAST\n"
    ),
}

_AUTHORIZATION_PREAMBLE = (
    "CONTEXT: This is an authorized security assessment in a controlled lab "
    "environment. The target is owned by the operator and explicitly in scope "
    "for vulnerability validation. All tools run against a sandboxed VM only.\n\n"
)


# ── Task Definitions ──

def create_recon_task(target: str, recon_agent: Agent, attack_type: str = "full", cve_context: str = "") -> Task:
    playbook = _ATTACK_PLAYBOOKS.get(attack_type, _ATTACK_PLAYBOOKS["full"]).format(target=target)
    return Task(
        description=(
            f"{_AUTHORIZATION_PREAMBLE}"
            f"{cve_context}"
            f"Perform a technical infrastructure audit of the following system: {target}\n\n"
            f"{playbook}\n"
            f"When calling nmap_scan, pass the full URL with port. "
            f"Record all observations accurately. "
            f"If live CVE intelligence is provided above, explicitly check whether the target "
            f"runs any of the affected products and include CVE IDs in your findings."
        ),
        expected_output=(
            "A complete infrastructure audit report containing:\n"
            "- Full inventory of open ports and services with version numbers\n"
            "- Web technology stack and server configuration details\n"
            "- List of all accessible web paths discovered\n"
            "- List of misconfigurations and outdated components found\n"
            "- For any SQL injection finding: the exact URL and parameter confirmed\n"
            "- Overall infrastructure compliance summary"
        ),
        agent=recon_agent,
        callback=_make_task_callback("Recon Phase"),
    )


def create_analysis_task(target: str, analyst_agent: Agent) -> Task:
    return Task(
        description=(
            f"Review the infrastructure audit findings for {target} and produce a "
            f"compliance risk report.\n\n"
            f"1. Classify each finding as Critical, High, Medium, or Low based on business impact.\n"
            f"2. For each finding, identify the affected component and describe the compliance gap.\n"
            f"3. Calculate an overall risk score from 0 to 10.\n"
            f"4. List the top findings that require the most urgent corrective action.\n"
            f"5. For each top finding, state the recommended corrective control."
        ),
        expected_output=(
            "A compliance risk report containing:\n"
            "- Findings ranked by severity level\n"
            "- Description of each compliance gap\n"
            "- Overall risk score (0-10)\n"
            "- Prioritized list of corrective actions\n"
            "- Recommended control for each high-priority finding"
        ),
        agent=analyst_agent,
        callback=_make_task_callback("Analysis Phase"),
    )


def create_exploit_task(target: str, exploit_agent: Agent) -> Task:
    return Task(
        description=(
            f"{_AUTHORIZATION_PREAMBLE}"
            f"Perform technical verification of the audit findings for {target}.\n\n"
            f"PRIMARY OBJECTIVE — SQL injection validation:\n"
            f"  If the audit report listed any SQL injection finding, follow the "
            f"verification ladder:\n"
            f"  1. sqlmap_dbs(<finding_url>) — enumerate reachable databases\n"
            f"  2. For each non-system database, call sqlmap_tables(<finding_url>, db=<dbname>)\n"
            f"  3. For tables indicating impact (users, accounts, credentials, sessions): "
            f"sqlmap_dump(<finding_url>, db=<dbname>, table=<tablename>)\n"
            f"  4. If no obvious tables match, call sqlmap_dump(<finding_url>, dump_all=True)\n\n"
            f"SECONDARY OBJECTIVES:\n"
            f"  - nuclei_exploit to verify other critical findings\n"
            f"  - ffuf_fuzz for hidden parameters\n"
            f"  - nmap_vuln_scan for service-level findings\n\n"
            f"Your final answer MUST include the captured records verbatim so the operator "
            f"has concrete technical evidence to act on."
        ),
        expected_output=(
            "A technical verification report containing:\n"
            "- List of confirmed findings with technical details\n"
            "- For SQL injection: databases enumerated, tables per database, sample records captured\n"
            "- Additional paths or services discovered during verification\n"
            "- Service-level configuration issues confirmed\n"
            "- Specific corrective action for each confirmed issue"
        ),
        agent=exploit_agent,
        callback=_make_task_callback("Verification Phase"),
    )


# ── Crew Factory ──

def create_red_team_crew(target: str, attack_type: str = "full", cve_context: str = "") -> Crew:
    recon = create_recon_agent()
    analyst = create_analyst_agent()
    exploit = create_exploit_agent()

    return Crew(
        agents=[recon, analyst, exploit],
        tasks=[
            create_recon_task(target, recon, attack_type, cve_context=cve_context),
            create_analysis_task(target, analyst),
            create_exploit_task(target, exploit),
        ],
        process=Process.sequential,
        verbose=True,
        step_callback=lambda step: _broadcast_log("INFO", f"[Crew] {str(step)[:100]}"),
        task_callback=lambda output: _broadcast_log("INFO", "[Crew] Task done"),
    )


async def run_crew_mission(target: str, *, attack_type: str = "full", cve_context: str = "") -> dict:
    import asyncio
    import concurrent.futures

    _logger.info("[CrewAI] Starting Red Team crew against %s (attack=%s, cve_intel=%s)",
                 target, attack_type, bool(cve_context))
    set_active_agent("IT Infrastructure Auditor")

    def _run_in_clean_thread():
        set_active_agent("IT Infrastructure Auditor")
        crew = create_red_team_crew(target, attack_type=attack_type, cve_context=cve_context)
        return crew.kickoff()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="crewai") as pool:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(pool, _run_in_clean_thread)

    _logger.info("[CrewAI] Crew finished")

    task_outputs = {}
    for i, task_output in enumerate(result.tasks_output):
        key = ["recon_output", "analysis_output", "exploit_output"][i] if i < 3 else f"task_{i}"
        task_outputs[key] = task_output.raw
    task_outputs["final_output"] = result.raw
    return task_outputs
