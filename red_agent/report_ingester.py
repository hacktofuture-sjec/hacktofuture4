"""Red Team Report Ingester — parses pen-test reports and publishes findings.

Accepts a Red team penetration test report (structured or raw) and converts
each finding into an event on the EventBus. This enables the Blue Agent's
remediation engine to act on findings simultaneously as the Red team operates.

Flow:
  1. Red Agent completes a scan/exploit phase and produces a report
  2. Report is ingested via ingest_report()
  3. Each finding is published as a red_finding_received event
  4. Blue's RemediationEngine picks up each finding and applies fixes
  5. red_report_complete is emitted when all findings are published
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.event_bus import event_bus

logger = logging.getLogger(__name__)


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


# ---------------------------------------------------------------------------
# Report parsing
# ---------------------------------------------------------------------------

def parse_report(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse a Red team report into a list of individual findings.

    Accepts the structured JSON report format from the Red Agent.
    Each finding gets a severity, category, and actionable details.
    """
    findings: List[Dict[str, Any]] = []

    # ── Recon findings (Phase 1) ──────────────────────────────────
    recon = report.get("recon", {})

    # Open ports / services
    for port_info in recon.get("open_ports", []):
        findings.append({
            "id": f"recon-port-{port_info.get('port', 0)}",
            "phase": "recon",
            "category": "open_port",
            "severity": "medium",
            "port": port_info.get("port"),
            "service": port_info.get("service", "unknown"),
            "version": port_info.get("version", ""),
            "description": f"Open port {port_info.get('port')} running {port_info.get('service', 'unknown')}",
        })

    # Tech stack
    tech = recon.get("tech_stack", {})
    if tech:
        findings.append({
            "id": "recon-tech-stack",
            "phase": "recon",
            "category": "tech_disclosure",
            "severity": "low",
            "tech_stack": tech,
            "description": f"Tech stack identified: {', '.join(tech.values()) if isinstance(tech, dict) else str(tech)}",
        })

    # Vulnerabilities discovered
    for vuln in recon.get("vulnerabilities", []):
        findings.append({
            "id": f"recon-vuln-{vuln.get('type', 'unknown')}",
            "phase": "recon",
            "category": vuln.get("type", "vulnerability"),
            "severity": vuln.get("severity", "high"),
            "endpoint": vuln.get("endpoint", ""),
            "description": vuln.get("description", ""),
            "mitre_attack": vuln.get("mitre_attack", ""),
            "cve_id": vuln.get("cve_id", ""),
        })

    # Directories / endpoints found
    for endpoint in recon.get("endpoints_found", []):
        findings.append({
            "id": f"recon-endpoint-{endpoint.get('path', '').replace('/', '-')}",
            "phase": "recon",
            "category": "endpoint_discovered",
            "severity": "info",
            "endpoint": endpoint.get("path", ""),
            "method": endpoint.get("method", "GET"),
            "description": f"Endpoint discovered: {endpoint.get('path', '')}",
        })

    # ── Exploit findings (Phase 2) ────────────────────────────────
    exploit = report.get("exploit", {})

    # Database access
    db_info = exploit.get("database", {})
    if db_info:
        findings.append({
            "id": "exploit-db-access",
            "phase": "exploit",
            "category": "database_compromised",
            "severity": "critical",
            "db_type": db_info.get("type", "unknown"),
            "tables": db_info.get("tables", []),
            "description": f"Database accessed: {db_info.get('type', 'unknown')} — tables: {', '.join(db_info.get('tables', []))}",
        })

    # Exfiltrated data
    for table_dump in exploit.get("exfiltrated_data", []):
        row_count = len(table_dump.get("rows", []))
        findings.append({
            "id": f"exploit-exfil-{table_dump.get('table', 'unknown')}",
            "phase": "exploit",
            "category": "data_exfiltration",
            "severity": "critical",
            "table": table_dump.get("table", ""),
            "row_count": row_count,
            "columns": table_dump.get("columns", []),
            "has_credentials": table_dump.get("has_credentials", False),
            "has_plaintext_passwords": table_dump.get("has_plaintext_passwords", False),
            "description": f"Exfiltrated {row_count} rows from '{table_dump.get('table', '')}' table"
                + (" — PLAINTEXT PASSWORDS FOUND" if table_dump.get("has_plaintext_passwords") else ""),
        })

    # Credentials stolen
    creds = exploit.get("credentials_stolen", [])
    if creds:
        admin_count = sum(1 for c in creds if c.get("role") == "admin")
        findings.append({
            "id": "exploit-creds-stolen",
            "phase": "exploit",
            "category": "credential_theft",
            "severity": "critical",
            "count": len(creds),
            "admin_count": admin_count,
            "description": f"{len(creds)} credentials stolen ({admin_count} admin accounts) — plaintext passwords",
        })

    # ── Recommendations → findings ────────────────────────────────
    for rec in report.get("recommendations", []):
        findings.append({
            "id": f"rec-{rec.get('action', 'unknown').replace(' ', '-')[:30]}",
            "phase": "recommendation",
            "category": rec.get("category", "remediation"),
            "severity": rec.get("severity", "high"),
            "action": rec.get("action", ""),
            "description": rec.get("description", rec.get("action", "")),
        })

    return findings


# ---------------------------------------------------------------------------
# Event publishing
# ---------------------------------------------------------------------------

async def ingest_report(report: Dict[str, Any]) -> Dict[str, Any]:
    """Ingest a Red team report: parse it, publish each finding to EventBus.

    This runs concurrently — Blue Agent's RemediationEngine picks up
    each finding in real-time and begins remediation simultaneously.

    Returns summary of findings published.
    """
    ts = _ts()
    target = report.get("target", "unknown")
    risk_score = report.get("risk_score", 0.0)

    print(
        f"{ts} < report_ingester: Ingesting Red team report for {target} "
        f"(risk: {risk_score}/10)"
    )

    findings = parse_report(report)

    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    published = 0

    for finding in findings:
        sev = finding.get("severity", "medium")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

        ts = _ts()
        print(
            f"{ts} < report_ingester: [{sev.upper()}] {finding['category']}: "
            f"{finding['description'][:80]}"
        )

        # Publish each finding — Blue remediation picks these up simultaneously
        await event_bus.emit("red_finding_received", {
            "finding": finding,
            "target": target,
            "risk_score": risk_score,
            "timestamp": datetime.now().isoformat(),
        })

        published += 1
        # Small delay between findings to allow Blue to process in parallel
        await asyncio.sleep(0.1)

    # Signal the full report is done
    summary = {
        "target": target,
        "risk_score": risk_score,
        "total_findings": len(findings),
        "severity_counts": severity_counts,
        "findings_published": published,
    }

    await event_bus.emit("red_report_complete", summary)

    ts = _ts()
    print(
        f"{ts} < report_ingester: Report complete — {published} findings published "
        f"(critical={severity_counts['critical']}, high={severity_counts['high']}, "
        f"medium={severity_counts['medium']})"
    )

    return summary


def build_report_from_sample() -> Dict[str, Any]:
    """Build a structured report matching the sample Red team pen-test output.

    This converts the sample report into the structured format that
    ingest_report() expects.
    """
    return {
        "target": "http://172.25.8.172:5000",
        "risk_score": 10.0,
        "recon": {
            "open_ports": [
                {"port": 5000, "service": "Flask", "version": "Werkzeug/3.1.8"},
            ],
            "tech_stack": {
                "language": "Python",
                "framework": "Flask",
                "database": "SQLite",
            },
            "vulnerabilities": [
                {
                    "type": "sql_injection",
                    "severity": "critical",
                    "endpoint": "/login",
                    "description": "SQL Injection on /login — login form accepts unsanitized user input directly into SQL queries",
                    "mitre_attack": "T1190",
                },
            ],
            "endpoints_found": [
                {"path": "/login", "method": "POST"},
                {"path": "/search", "method": "GET"},
                {"path": "/profile", "method": "GET"},
            ],
        },
        "exploit": {
            "database": {
                "type": "SQLite",
                "tables": ["users", "products", "secrets"],
            },
            "exfiltrated_data": [
                {
                    "table": "users",
                    "columns": ["id", "username", "email", "password", "role"],
                    "rows": [
                        {"id": 1, "username": "alice", "email": "alice@example.com", "password": "password123", "role": "user"},
                        {"id": 2, "username": "bob", "email": "bob@example.com", "password": "letmein", "role": "user"},
                        {"id": 3, "username": "admin", "email": "admin@vulnshop.io", "password": "sup3rs3cr3t", "role": "admin"},
                    ],
                    "has_credentials": True,
                    "has_plaintext_passwords": True,
                },
            ],
            "credentials_stolen": [
                {"username": "alice", "role": "user"},
                {"username": "bob", "role": "user"},
                {"username": "admin", "role": "admin"},
            ],
        },
        "recommendations": [
            {
                "severity": "critical",
                "category": "sql_injection_fix",
                "action": "parameterized_queries",
                "description": "Use parameterized queries — never concatenate user input into SQL",
            },
            {
                "severity": "critical",
                "category": "password_hashing",
                "action": "hash_passwords",
                "description": "Hash passwords with bcrypt/argon2 — credentials are stored in plaintext",
            },
            {
                "severity": "high",
                "category": "rate_limiting",
                "action": "rate_limit_login",
                "description": "Implement rate limiting on login endpoints",
            },
            {
                "severity": "high",
                "category": "waf_deployment",
                "action": "deploy_waf",
                "description": "Deploy a Web Application Firewall (WAF)",
            },
            {
                "severity": "medium",
                "category": "admin_separation",
                "action": "separate_admin_auth",
                "description": "Separate admin accounts into a different authentication system",
            },
            {
                "severity": "medium",
                "category": "captcha",
                "action": "add_captcha",
                "description": "Add CAPTCHA to prevent automated attacks",
            },
        ],
    }
