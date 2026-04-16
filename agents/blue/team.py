"""
  Detector   — classifies the feature vector using BlueAgent.classify_and_respond
               decides alert severity and attack class
  Responder  — given an alert, picks the best immediate response
               (block_ip / rate_limit / add_waf_rule)

All two run in parallel per (service, feature_vec) pair.
The orchestrator calls BlueTeam.process_turn() which coordinates them and returns
a list of response dicts, one per feature vector.
"""
import asyncio
import logging
import time
from typing import Optional

import numpy as np

log = logging.getLogger("blue.team")

# ── Responder decision table ───────────────────────────────────────────────────
# Maps (attack_class, severity) → recommended immediate action
RESPONDER_POLICY = {
    ("r2l",  "HIGH"):   "block_ip",
    ("u2r",  "HIGH"):   "block_ip",
    ("probe","MEDIUM"): "rate_limit",
    ("dos",  "MEDIUM"): "add_waf_rule",
}

DEFAULT_RESPONDER_ACTION = "rate_limit"

# ── Patcher eagerness ─────────────────────────────────────────────────────────
# Only patch after this many alerts on a service (avoid premature patching)
PATCHER_MIN_ALERTS = 1
PATCHER_MIN_SEVERITY = {"HIGH", "MEDIUM"}


# ─────────────────────────────────────────────────────────────────────────────
class Detector:
    """
    Specialist 1: Classification.
    Wraps BlueAgent.classify_and_respond — keeps its own alert history
    for rationale generation.
    """
    NAME = "Detector"

    def __init__(self, blue_agent):
        self._agent = blue_agent
        self._alert_count = 0

    async def analyse(self, feature_vec: np.ndarray, src_ip: str, service: str) -> dict:
        # Offload CPU-bound inference to a thread so we don't block the event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._agent.classify_and_respond,
            feature_vec,
            src_ip,
        )
        if result.get("action") != "CLEAN":
            self._alert_count += 1

        result["_service"]  = service
        result["_agent"]    = self.NAME
        result["rationale"] = self._build_rationale(result, service)
        return result

    def _build_rationale(self, result: dict, service: str) -> str:
        ac  = result.get("attack_class", "unknown")
        sev = result.get("severity", "none")
        conf = result.get("confidence", 0)
        if result.get("action") == "CLEAN":
            return f"[Detector] {service}: traffic looks benign (conf={conf:.2f})"
        return (
            f"[Detector] {service}: classified as {ac} (sev={sev}, "
            f"conf={conf:.2f}, alerts_total={self._alert_count})"
        )


# ─────────────────────────────────────────────────────────────────────────────
class Responder:
    """
    Specialist 2: Immediate countermeasure selection.
    Receives Detector's alert and picks the best action.
    Has its own budget — won't block the same IP twice.
    """
    NAME = "Responder"

    def __init__(self):
        self._responded_ips: set = set()

    async def decide(self, detector_result: dict) -> Optional[dict]:
        """Returns an enriched response dict, or None if no action needed."""
        if detector_result.get("action") == "CLEAN":
            return None

        ac    = detector_result.get("attack_class", "unknown")
        sev   = detector_result.get("severity", "none")
        ip    = detector_result.get("src_ip", "unknown")
        svc   = detector_result.get("_service", "unknown")

        # Pick action from policy table
        action = RESPONDER_POLICY.get((ac, sev), DEFAULT_RESPONDER_ACTION)

        # Avoid duplicate rate_limit for same IP (if already rate limited strongly)
        if action == "rate_limit" and ip in self._responded_ips:
            action = "add_waf_rule"

        if action in ("rate_limit", "block_ip"):
            self._responded_ips.add(ip)

        await asyncio.sleep(0)   # yield to event loop

        return {
            **detector_result,
            "action":   action,
            "_agent":   self.NAME,
            "rationale": (
                f"[Responder] {svc}: {action} on {ip} "
                f"(policy={ac}/{sev})"
            ),
        }


# ─────────────────────────────────────────────────────────────────────────────
class BlueTeam:
    """
    Coordinator: runs Detector, Responder, Patcher concurrently per feature vec.

    Usage:
        team = BlueTeam(blue_agent, patch_registry)
        results = await team.process_turn(features_by_service)
        # results: list of response dicts (one per feature vec that triggered an alert)
    """

    def __init__(self, blue_agent, patch_registry: dict = None):
        self._agent     = blue_agent
        self._detector  = Detector(blue_agent)
        self._responder = Responder()

    async def process_turn(
        self,
        features_by_service: dict,
    ) -> list[dict]:
        """
        features_by_service: { service_name: [(feature_vec, src_ip), ...] }
        Returns flat list of response dicts (alerts + patch events).
        """
        tasks = []
        for service, fv_list in features_by_service.items():
            for fv, src_ip in fv_list:
                tasks.append(self._process_single(fv, src_ip, service))

        results_nested = await asyncio.gather(*tasks)

        # Flatten — each task returns a (list of 0-3 dicts)
        out = []
        for group in results_nested:
            out.extend(r for r in group if r is not None)
        return out

    async def _process_single(
        self, feature_vec: np.ndarray, src_ip: str, service: str
    ) -> list[Optional[dict]]:
        """Run all three sub-agents concurrently for one feature vector."""
        # Detector must run first — Responder and Patcher depend on its output
        detection = await self._detector.analyse(feature_vec, src_ip, service)

        if detection.get("action") == "CLEAN":
            return [detection]

        # Responder runs once detection is ready
        response = await self._responder.decide(detection)

        # Return only the final decision (countermeasure), resolving the double-counting bug.
        return [response] if response else [detection]
