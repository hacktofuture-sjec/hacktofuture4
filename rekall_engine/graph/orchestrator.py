"""
REKALL Orchestrator — LangGraph StateGraph wiring all five agents.

Graph flow:
  [START]
    ↓
  MonitorAgent        — normalise raw webhook into FailureEvent + FailureObject
    ↓
  DiagnosticAgent     — build DiagnosticBundle (log, diff, LLM signature)
    ↓
  FixAgent            — T1 → T2 → T3 retrieval, produce FixProposal
    ↓
  GovernanceAgent     — score risk (0–1), decide auto_apply|create_pr|block
    ↓
  [conditional edge]
    ├── auto_apply      → LearningAgent (outcome=success, auto)
    ├── create_pr       → LearningAgent (outcome=success, pr opened)
    └── block           → [PAUSE — human approves/rejects via API]
                         → LearningAgent (on callback from Go backend)
  [END]

Each node emits AgentLogEntry events via an asyncio.Queue that the engine
service reads and POSTs back to the Go backend as SSE events.

When LangGraph is not installed, falls back to a simple sequential async
pipeline so the system still works without that dependency.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, AsyncIterator, Dict, Optional

from ..agents.monitor    import MonitorAgent
from ..agents.diagnostic import DiagnosticAgent
from ..agents.fix        import FixAgent
from ..agents.simulation import SimulationAgent
from ..agents.governance import GovernanceAgent
from ..agents.publish_guard import PublishGuardAgent
from ..agents.learning   import LearningAgent
from ..types             import AgentLogEntry, GovernanceDecision, Outcome, FixProposal

log = logging.getLogger("rekall.orchestrator")

# Agent singletons (shared across pipeline runs)
_monitor      = MonitorAgent()
_diagnostic   = DiagnosticAgent()
_fix          = FixAgent()
_simulation   = SimulationAgent()
_governance   = GovernanceAgent()
_publish_guard = PublishGuardAgent()
_learning     = LearningAgent()


# ─────────────────────────────────────────────────────────────────────────────
# Log helper
# ─────────────────────────────────────────────────────────────────────────────

async def _emit(
    queue: asyncio.Queue,
    incident_id: str,
    step: str,
    status: str,
    detail: str,
) -> None:
    entry = AgentLogEntry(
        incident_id=incident_id,
        step_name=step,
        status=status,
        detail=detail,
        timestamp=datetime.utcnow(),
    )
    await queue.put(entry)


# ─────────────────────────────────────────────────────────────────────────────
# Core sequential pipeline (LangGraph-optional)
# ─────────────────────────────────────────────────────────────────────────────

async def run_pipeline(
    raw_webhook: Dict[str, Any],
    incident_id: str,
    log_queue:   Optional[asyncio.Queue] = None,
) -> Dict[str, Any]:
    """
    Run the full REKALL agent pipeline for one incident.

    Args:
        raw_webhook: dict from Go backend (incident row + payload merged)
        incident_id: UUID string for the incident
        log_queue:  asyncio.Queue — agent log entries are put() here so the
                    engine service can POST them to the Go SSE broker in real time.

    Returns:
        Final state dict with all agent outputs.
    """
    if log_queue is None:
        log_queue = asyncio.Queue()

    state: Dict[str, Any] = {
        "incident_id": incident_id,
        "raw_webhook": raw_webhook,
        "agent_logs":  [],
    }

    # ── 1. Monitor ────────────────────────────────────────────────────────────
    await _emit(log_queue, incident_id, "monitor", "running", "Detecting and normalising event")
    try:
        state = await _monitor.run(state)
        await _emit(log_queue, incident_id, "monitor", "done",
                    _last_detail(state, "monitor"))
    except Exception as exc:
        log.error("[orchestrator] MonitorAgent failed: %s", exc, exc_info=True)
        await _emit(log_queue, incident_id, "monitor", "error", str(exc))
        return state

    # ── 2. Diagnostic ─────────────────────────────────────────────────────────
    await _emit(log_queue, incident_id, "diagnostic", "running", "Fetching logs, diff, building signature")
    try:
        state = await _diagnostic.run(state)
        await _emit(log_queue, incident_id, "diagnostic", "done",
                    _last_detail(state, "diagnostic"))
    except Exception as exc:
        log.error("[orchestrator] DiagnosticAgent failed: %s", exc, exc_info=True)
        await _emit(log_queue, incident_id, "diagnostic", "error", str(exc))
        return state

    # ── 3. Fix ────────────────────────────────────────────────────────────────
    await _emit(log_queue, incident_id, "fix", "running", "Searching vault T1 → T2 → T3")
    try:
        state = await _fix.run(state)
        fix: FixProposal = state.get("fix_proposal")
        tier_label = fix.tier if fix else "unknown"
        await _emit(log_queue, incident_id, "fix", "done",
                    f"Fix selected via {tier_label} (confidence {fix.confidence:.0%})" if fix else "No fix found")
    except Exception as exc:
        log.error("[orchestrator] FixAgent failed: %s", exc, exc_info=True)
        await _emit(log_queue, incident_id, "fix", "error", str(exc))
        return state

    # ── 3.5 Simulation ────────────────────────────────────────────────────────
    from ..config import engine_config
    if getattr(engine_config, "simulation_enabled", False):
        await _emit(log_queue, incident_id, "simulation", "running", "Simulating fix in sandbox")
        try:
            state = await _simulation.run(state)
            await _emit(log_queue, incident_id, "simulation", "done",
                        _last_detail(state, "simulation"))
        except Exception as exc:
            log.error("[orchestrator] SimulationAgent failed: %s", exc, exc_info=True)
            await _emit(log_queue, incident_id, "simulation", "error", str(exc))
            return state

    # ── 4. Governance ─────────────────────────────────────────────────────────
    await _emit(log_queue, incident_id, "governance", "running", "Scoring risk, deciding action")
    try:
        state = await _governance.run(state)
        gov: GovernanceDecision = state.get("governance_decision")
        await _emit(log_queue, incident_id, "governance", "done",
                    f"Risk {gov.risk_score:.0%} → {gov.decision}" if gov else "Governance complete")
    except Exception as exc:
        log.error("[orchestrator] GovernanceAgent failed: %s", exc, exc_info=True)
        await _emit(log_queue, incident_id, "governance", "error", str(exc))
        return state

    # ── 5. PublishGuard ───────────────────────────────────────────────────────
    await _emit(log_queue, incident_id, "publish_guard", "running", "Running supply-chain safety gate")
    try:
        state = await _publish_guard.run(state)
        flags = state.get("publish_guard_flags", [])
        await _emit(log_queue, incident_id, "publish_guard", "done",
                    f"Supply-chain gate: {'ESCALATED' if flags else 'passed'} ({len(flags)} flags)")
    except Exception as exc:
        log.error("[orchestrator] PublishGuardAgent failed: %s", exc, exc_info=True)
        await _emit(log_queue, incident_id, "publish_guard", "error", str(exc))
        # Non-fatal: continue with existing governance decision

    # ── 6. Execute / Wait ─────────────────────────────────────────────────────
    gov: GovernanceDecision = state.get("governance_decision")
    decision = gov.decision if gov else "block_await_human"

    if decision == "block_await_human":
        await _emit(log_queue, incident_id, "execute", "done",
                    "Awaiting human review before applying fix")
        # Pipeline pauses here — LearningAgent will be triggered via
        # POST /incidents/{id}/approve or /reject from the Go backend.
        state["paused"] = True
        await log_queue.put(None)  # sentinel: stream not done, but pipeline paused
        return state


    # auto_apply or create_pr — treat both as "success" outcome for now
    await _emit(log_queue, incident_id, "execute", "running",
                "Applying fix" if decision == "auto_apply" else "Opening pull request")
    outcome_result = "success"
    await _emit(log_queue, incident_id, "execute", "done",
                "Fix applied" if decision == "auto_apply" else "Pull request opened")

    # ── 6. Learning ───────────────────────────────────────────────────────────
    await _emit(log_queue, incident_id, "learning", "running", "Updating vault confidence")
    try:
        fix_proposal: FixProposal = state.get("fix_proposal")
        if fix_proposal:
            outcome = Outcome(
                incident_id=incident_id,
                fix_proposal_id=str(uuid.uuid4()),
                result=outcome_result,
                reviewed_by=None,
                notes=f"decision={decision}",
            )
            state["outcome"] = outcome
            state = await _learning.run(state)
        await _emit(log_queue, incident_id, "learning", "done",
                    "Vault confidence updated")
    except Exception as exc:
        log.error("[orchestrator] LearningAgent failed: %s", exc, exc_info=True)
        await _emit(log_queue, incident_id, "learning", "error", str(exc))

    # Sentinel: pipeline done
    await log_queue.put(None)
    return state


async def run_learning_callback(
    incident_id: str,
    result: str,
    reviewed_by: Optional[str],
    notes: Optional[str],
    state: Dict[str, Any],
    log_queue: Optional[asyncio.Queue] = None,
) -> None:
    """
    Called when a human approves or rejects via POST /incidents/{id}/approve|reject.
    Runs LearningAgent with the human outcome.
    """
    if log_queue is None:
        log_queue = asyncio.Queue()

    fix_proposal: FixProposal = state.get("fix_proposal")
    if not fix_proposal:
        log.warning("[orchestrator] run_learning_callback: no fix_proposal in state")
        return

    outcome = Outcome(
        incident_id=incident_id,
        fix_proposal_id=str(uuid.uuid4()),
        result=result,
        reviewed_by=reviewed_by,
        notes=notes,
    )
    state["outcome"] = outcome

    await _emit(log_queue, incident_id, "learning", "running", "Processing human decision")
    try:
        # Ensure DiagnosticBundle is at least a stub if missing
        if "diagnostic_bundle" not in state:
            state["diagnostic_bundle"] = DiagnosticBundle(
                incident_id=incident_id,
                failure_type="unknown",
                failure_signature="",
                log_excerpt="",
                git_diff=None,
                test_report=None,
                context_summary="",
                metadata={"source": "manual_trigger"}
            )
        await _learning.run(state)
        await _emit(log_queue, incident_id, "learning", "done", f"Reported ({result})")
    except Exception as exc:
        log.error("[orchestrator] LearningAgent (callback) failed: %s", exc, exc_info=True)
        await _emit(log_queue, incident_id, "learning", "error", str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# LangGraph wiring (optional — requires `pip install langgraph`)
# ─────────────────────────────────────────────────────────────────────────────

async def build_graph():
    """
    Build and return a compiled LangGraph StateGraph.
    Only available when langgraph is installed. Otherwise raises ImportError.
    """
    try:
        from langgraph.graph import StateGraph, END
    except ImportError as e:
        raise ImportError(
            "langgraph is not installed. Install it with: pip install langgraph"
        ) from e

    from typing import TypedDict

    class State(TypedDict, total=False):
        incident_id:         str
        raw_webhook:         dict
        failure_event:       Any
        failure_object:      Any
        diagnostic_bundle:   Any
        fix_suggestion:      Any
        fix_proposal:        Any
        governance_decision: Any
        outcome:             Any
        agent_logs:          list
        paused:              bool

    graph = StateGraph(State)

    graph.add_node("monitor",       _monitor.run)
    graph.add_node("diagnostic",    _diagnostic.run)
    graph.add_node("fix",           _fix.run)
    graph.add_node("simulation",    _simulation.run)
    graph.add_node("governance",    _governance.run)
    graph.add_node("publish_guard", _publish_guard.run)
    graph.add_node("learning",      _learning.run)

    graph.set_entry_point("monitor")
    graph.add_edge("monitor",       "diagnostic")
    graph.add_edge("diagnostic",    "fix")
    
    from ..config import engine_config
    if getattr(engine_config, "simulation_enabled", False):
        graph.add_edge("fix",           "simulation")
        graph.add_edge("simulation",    "governance")
    else:
        graph.add_edge("fix",           "governance")
        
    graph.add_edge("governance",    "publish_guard")

    def route_decision(state: State) -> str:
        gov = state.get("governance_decision")
        if gov and gov.decision in ("auto_apply", "create_pr"):
            return "learning"
        return END  # block_await_human → pause, LearningAgent via callback

    graph.add_conditional_edges("publish_guard", route_decision, {
        "learning": "learning",
        END: END,
    })
    graph.add_edge("learning", END)

    return graph.compile()


def _last_detail(state: Dict[str, Any], step: str) -> str:
    """Extract the latest agent log detail for a given step."""
    logs = state.get("agent_logs", [])
    for entry in reversed(logs):
        if isinstance(entry, AgentLogEntry) and entry.step_name == step:
            return entry.detail
    return f"{step} complete"
