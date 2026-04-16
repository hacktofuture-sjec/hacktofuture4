"""Remediation Engine — receives Red findings and applies fixes simultaneously.

Subscribes to red_finding_received events from the EventBus. As each finding
arrives (while the Red Agent is still scanning), the engine dispatches the
appropriate fix via FlaskFixer.

Simultaneous operation:
  - Red Agent publishes findings as they're discovered
  - Blue Remediation Engine fixes them in real-time
  - Both operate concurrently via asyncio + EventBus

The engine maps each finding category to a specific fix action:
  sql_injection          → fix_sql_injection()
  credential_theft       → fix_plaintext_passwords()
  data_exfiltration      → fix_secure_database()
  database_compromised   → fix_secure_database()
  rate_limiting          → fix_rate_limiting()
  waf_deployment         → fix_deploy_waf()
  admin_separation       → fix_admin_separation()
  captcha                → fix_add_captcha()
  password_hashing       → fix_plaintext_passwords()
  sql_injection_fix      → fix_sql_injection()
  server_hardening       → fix_server_hardening()
  idor_protection        → fix_idor_protection()

Emits:
  remediation_started  — when a fix begins
  remediation_complete — when a fix succeeds
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List

from core.event_bus import event_bus
from blue_agent.remediation.flask_fixer import FlaskFixer

logger = logging.getLogger(__name__)


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


# ---------------------------------------------------------------------------
# Category → fix action mapping
# ---------------------------------------------------------------------------

_CATEGORY_TO_FIX = {
    # Direct vulnerability categories
    "sql_injection": "fix_sql_injection",
    "sql_injection_fix": "fix_sql_injection",
    "credential_theft": "fix_plaintext_passwords",
    "password_hashing": "fix_plaintext_passwords",
    "data_exfiltration": "fix_secure_database",
    "database_compromised": "fix_secure_database",
    "rate_limiting": "fix_rate_limiting",
    "waf_deployment": "fix_deploy_waf",
    "admin_separation": "fix_admin_separation",
    "captcha": "fix_add_captcha",
    "server_hardening": "fix_server_hardening",
    "idor_protection": "fix_idor_protection",
    # Recon categories that trigger hardening
    "open_port": "fix_server_hardening",
    "tech_disclosure": "fix_server_hardening",
    "endpoint_discovered": "fix_deploy_waf",
}


class RemediationEngine:
    """Receives Red team findings via EventBus and remediates simultaneously.

    Usage::

        engine = RemediationEngine()
        engine.register()  # subscribe to EventBus
        # Now as Red findings arrive, fixes are applied automatically
    """

    def __init__(self) -> None:
        self.flask_fixer = FlaskFixer()
        self.findings_received: int = 0
        self.fixes_dispatched: int = 0
        self.findings_log: List[Dict[str, Any]] = []
        self._running: bool = False

    # ------------------------------------------------------------------
    # Subscription wiring
    # ------------------------------------------------------------------

    def register(self) -> None:
        """Subscribe to Red team findings on the EventBus."""
        event_bus.subscribe("red_finding_received", self._on_finding)
        event_bus.subscribe("red_report_complete", self._on_report_complete)
        ts = _ts()
        print(
            f"{ts} < remediation_engine: Subscribed to Red findings — "
            f"ready for simultaneous remediation"
        )

    # ------------------------------------------------------------------
    # Event handlers
    # ------------------------------------------------------------------

    async def _on_finding(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle a single Red team finding — dispatch the appropriate fix."""
        finding = data.get("finding", {})
        target = data.get("target", "unknown")
        self.findings_received += 1
        self.findings_log.append(finding)

        category = finding.get("category", "")
        severity = finding.get("severity", "medium")
        description = finding.get("description", "")

        ts = _ts()
        print(
            f"{ts} < remediation_engine: [{severity.upper()}] Received finding: "
            f"{category} — {description[:60]}"
        )

        # Emit that we're starting remediation
        await event_bus.emit("remediation_started", {
            "finding_id": finding.get("id", ""),
            "category": category,
            "severity": severity,
        })

        # Look up the fix action for this category
        fix_method_name = _CATEGORY_TO_FIX.get(category)

        if fix_method_name:
            fix_method = getattr(self.flask_fixer, fix_method_name, None)
            if fix_method:
                try:
                    # Some fixes need endpoint parameter
                    endpoint = finding.get("endpoint", "")
                    if fix_method_name in ("fix_sql_injection", "fix_rate_limiting", "fix_idor_protection") and endpoint:
                        result = await fix_method(endpoint)
                    else:
                        result = await fix_method()

                    self.fixes_dispatched += 1

                    await event_bus.emit("remediation_complete", {
                        "finding_id": finding.get("id", ""),
                        "category": category,
                        "severity": severity,
                        "fix": fix_method_name,
                        "result": result,
                        "status": "FIXED",
                    })

                except Exception as exc:
                    logger.error(f"RemediationEngine: fix failed for {category}: {exc}")
                    ts = _ts()
                    print(f"{ts} < remediation_engine: Fix FAILED for {category}: {exc}")
        else:
            ts = _ts()
            print(
                f"{ts} < remediation_engine: No specific fix mapped for "
                f"category '{category}' — logged for manual review"
            )

    async def _on_report_complete(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle the completion of a full Red team report."""
        total = data.get("total_findings", 0)
        severity_counts = data.get("severity_counts", {})

        ts = _ts()
        print(f"\n{ts} ╔═══════════════════════════════════════════════════════════════╗")
        print(f"{ts} ║  REMEDIATION SUMMARY                                         ║")
        print(f"{ts} ╠═══════════════════════════════════════════════════════════════╣")
        print(f"{ts} ║  Findings received: {self.findings_received:<40}║")
        print(f"{ts} ║  Fixes dispatched:  {self.fixes_dispatched:<40}║")
        print(f"{ts} ║  Total fix steps:   {self.flask_fixer.total_steps:<40}║")
        print(f"{ts} ╠═══════════════════════════════════════════════════════════════╣")
        print(f"{ts} ║  Applied fixes:                                              ║")
        for fix in self.flask_fixer.get_applied_fixes():
            fix_name = fix.get("fix_id", "")[:45]
            status = fix.get("status", "")
            print(f"{ts} ║    ✓ {fix_name:<44} {status:>8} ║")
        print(f"{ts} ╚═══════════════════════════════════════════════════════════════╝\n")

    # ------------------------------------------------------------------
    # Manual trigger — apply all fixes at once
    # ------------------------------------------------------------------

    async def remediate_full_report(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """Process a full Red team report and apply all fixes.

        This is the synchronous alternative to the EventBus-driven flow.
        Can be called directly from the API endpoint.
        """
        from red_agent.report_ingester import ingest_report

        # Start the EventBus-driven flow — findings will be published
        # and this engine's _on_finding handler will fix them simultaneously
        summary = await ingest_report(report)

        # Wait a moment for all async event handlers to complete
        await asyncio.sleep(1.0)

        return {
            "report_summary": summary,
            "remediation": {
                "findings_received": self.findings_received,
                "fixes_applied": self.fixes_dispatched,
                "total_steps": self.flask_fixer.total_steps,
                "applied_fixes": self.flask_fixer.get_applied_fixes(),
            },
        }

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_status(self) -> Dict[str, Any]:
        return {
            "findings_received": self.findings_received,
            "fixes_dispatched": self.fixes_dispatched,
            "total_steps": self.flask_fixer.total_steps,
            "applied_fixes": self.flask_fixer.get_applied_fixes(),
        }
