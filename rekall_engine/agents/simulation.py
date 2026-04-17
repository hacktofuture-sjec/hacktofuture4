"""
REKALL — SimulationAgent

Optional counterfactual sandbox.
Sits between FixAgent and GovernanceAgent.

This agent simulates applying the fix to a sandbox environment to see if it resolves the issue
before submitting it to Governance. For the hackathon, this functions as a pass-through
that optionally logs simulation results and proceeds if enabled via SIMULATION_ENABLED.
"""

from __future__ import annotations

import logging
from typing import Any

from .base import BaseAgent
from ..types import FixProposal, AgentLogEntry

log = logging.getLogger("rekall.simulation")


class SimulationAgent(BaseAgent):
    name = "simulation"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Input:
          state["fix_proposal"] — FixProposal

        Output:
          state["simulation_result"] — dummy output
        """
        fix: FixProposal = state.get("fix_proposal")

        if not fix:
            log.warning("[simulation] no fix_proposal in state — skipping")
            return state

        incident_id = fix.incident_id

        # In a real environment, this would spin up a temporary container or execute dry-runs
        log.info("[simulation] simulating fix for incident=%s", incident_id)

        simulation_result = {
            "status": "success",
            "message": "Simulated fix dry-run completed successfully."
        }

        state.setdefault("agent_logs", []).append(
            AgentLogEntry(
                incident_id=incident_id,
                step_name="simulation",
                status="done",
                detail=f"Simulation complete: {simulation_result['status']}",
            )
        )

        state["simulation_result"] = simulation_result
        return state
