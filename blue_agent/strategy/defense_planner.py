from __future__ import annotations

"""Defense Planner — prioritised response planning based on threat landscape.

Analyzes incoming threats and vulnerability data to generate prioritised
defense plans. Considers:
  - CVE severity (CVSS score)
  - Asset criticality (databases > web servers > system services)
  - Environment exposure (cloud-facing > hybrid DMZ > on-prem internal)
  - Active attack indicators from detection layer
  - Historical attack patterns

Subscribes to: vulnerability_found, environment_alert, scan_complete
Produces defense plans consumed by the response engine and auto-patcher.
"""

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from core.event_bus import event_bus

logger = logging.getLogger(__name__)


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


@dataclass
class DefenseAction:
    """A single planned defense action."""
    priority: int        # 1 = highest
    action: str          # patch, isolate, block, harden, upgrade, remove
    target: str          # service or resource identifier
    reason: str          # why this action is needed
    cve_id: str | None = None
    environment: str = ""
    estimated_impact: str = ""  # what happens if not addressed

    def to_dict(self) -> Dict[str, Any]:
        return {
            "priority": self.priority,
            "action": self.action,
            "target": self.target,
            "reason": self.reason,
            "cve_id": self.cve_id,
            "environment": self.environment,
            "estimated_impact": self.estimated_impact,
        }


@dataclass
class ThreatProfile:
    """Current threat profile for a single asset."""
    asset_id: str
    cve_ids: List[str] = field(default_factory=list)
    max_cvss: float = 0.0
    attack_indicators: int = 0
    environment: str = ""
    layer: str = ""
    last_updated: float = field(default_factory=time.time)


# Priority weights
_SEVERITY_WEIGHT = {"critical": 100, "high": 70, "medium": 40, "low": 10}
_LAYER_WEIGHT = {"database": 50, "webserver": 40, "application": 35, "system": 30, "frontend": 20, "container": 25}
_ENV_WEIGHT = {"cloud": 40, "hybrid": 35, "onprem": 25}


class DefensePlanner:
    """Plans and prioritises defensive actions based on the current threat landscape.

    Call register() once during initialisation to wire event subscriptions.
    """

    def __init__(self) -> None:
        self.threat_profiles: Dict[str, ThreatProfile] = {}
        self.current_plan: List[DefenseAction] = []
        self.plans_generated: int = 0
        self._pending_vulns: List[Dict[str, Any]] = []
        self._pending_alerts: List[Dict[str, Any]] = []
        self._running: bool = False

    def register(self) -> None:
        """Subscribe to events that feed the planner."""
        event_bus.subscribe("vulnerability_found", self._on_vulnerability)
        event_bus.subscribe("environment_alert", self._on_env_alert)
        event_bus.subscribe("scan_complete", self._on_scan_complete)

    async def _on_vulnerability(self, event_type: str, data: Dict[str, Any]) -> None:
        """Accumulate vulnerability findings for next planning cycle."""
        self._pending_vulns.append(data)

        asset_id = data.get("asset_id", "")
        profile = self.threat_profiles.get(asset_id)
        if profile is None:
            profile = ThreatProfile(
                asset_id=asset_id,
                environment=data.get("environment", ""),
                layer=data.get("layer", ""),
            )
            self.threat_profiles[asset_id] = profile

        cve_id = data.get("cve_id", "")
        if cve_id and cve_id not in profile.cve_ids:
            profile.cve_ids.append(cve_id)
        cvss = data.get("cvss_score", 0.0)
        if cvss > profile.max_cvss:
            profile.max_cvss = cvss
        profile.last_updated = time.time()

    async def _on_env_alert(self, event_type: str, data: Dict[str, Any]) -> None:
        """Accumulate environment alerts for planning."""
        self._pending_alerts.append(data)

    async def _on_scan_complete(self, event_type: str, data: Dict[str, Any]) -> None:
        """Trigger plan generation after each scan cycle completes."""
        if self._pending_vulns or self._pending_alerts:
            await self.generate_plan()

    async def generate_plan(self) -> List[DefenseAction]:
        """Generate a prioritised defense plan from accumulated threat data."""
        self.plans_generated += 1
        actions: List[DefenseAction] = []

        # Process vulnerability findings
        for vuln in self._pending_vulns:
            severity = vuln.get("severity", "medium")
            cvss = vuln.get("cvss_score", 0.0)
            layer = vuln.get("layer", "")
            env = vuln.get("environment", "")
            service = vuln.get("service", "")
            cve_id = vuln.get("cve_id", "")
            fix = vuln.get("fix", "")
            host = vuln.get("host", "")
            port = vuln.get("port", 0)

            # Calculate priority score (lower = more urgent)
            score = (
                _SEVERITY_WEIGHT.get(severity, 10)
                + _LAYER_WEIGHT.get(layer, 20)
                + _ENV_WEIGHT.get(env, 20)
            )

            # Determine action type
            if cvss >= 9.0:
                action_type = "isolate_and_patch"
                impact = "Remote code execution or full system compromise"
            elif cvss >= 7.0:
                action_type = "patch"
                impact = "Significant security risk; possible data breach"
            elif cvss >= 4.0:
                action_type = "harden"
                impact = "Moderate risk; may allow information disclosure"
            else:
                action_type = "monitor"
                impact = "Low risk; cosmetic or informational"

            actions.append(DefenseAction(
                priority=score,
                action=action_type,
                target=f"{service}@{host}:{port}",
                reason=f"{cve_id} (CVSS {cvss}) — {fix}",
                cve_id=cve_id,
                environment=env,
                estimated_impact=impact,
            ))

        # Process environment alerts
        for alert in self._pending_alerts:
            severity = alert.get("severity", "medium")
            env = alert.get("environment", "")
            score = _SEVERITY_WEIGHT.get(severity, 10) + _ENV_WEIGHT.get(env, 20)

            if severity in ("critical", "high"):
                action_type = "remediate"
            else:
                action_type = "review"

            actions.append(DefenseAction(
                priority=score,
                action=action_type,
                target=alert.get("resource", "unknown"),
                reason=f"{alert.get('title', '')} — {alert.get('recommendation', '')}",
                environment=env,
                estimated_impact=alert.get("description", ""),
            ))

        # Sort by priority (highest score first = most urgent)
        actions.sort(key=lambda a: a.priority, reverse=True)
        self.current_plan = actions

        # Clear pending data
        self._pending_vulns.clear()
        self._pending_alerts.clear()

        if actions:
            ts = _ts()
            print(
                f"{ts} < defense_planner: Plan #{self.plans_generated} generated — "
                f"{len(actions)} actions, top priority: {actions[0].action} on {actions[0].target}"
            )

        return actions

    def get_current_plan(self) -> List[Dict[str, Any]]:
        """Return the current defense plan as a list of dicts."""
        return [a.to_dict() for a in self.current_plan]

    def get_threat_summary(self) -> Dict[str, Any]:
        """Return a summary of the current threat landscape."""
        total_cves = sum(len(p.cve_ids) for p in self.threat_profiles.values())
        critical_assets = sum(
            1 for p in self.threat_profiles.values() if p.max_cvss >= 9.0
        )
        high_assets = sum(
            1 for p in self.threat_profiles.values() if 7.0 <= p.max_cvss < 9.0
        )

        return {
            "total_threat_profiles": len(self.threat_profiles),
            "total_cves_tracked": total_cves,
            "critical_assets": critical_assets,
            "high_risk_assets": high_assets,
            "plans_generated": self.plans_generated,
            "current_plan_actions": len(self.current_plan),
        }
