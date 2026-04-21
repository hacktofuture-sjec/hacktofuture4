from __future__ import annotations

"""Multi-environment monitoring — Cloud, On-Premise, and Hybrid.

Runs three parallel monitoring loops, one per environment class.
Each loop checks environment-specific security controls and emits
alerts when misconfigurations or policy violations are detected.

Cloud monitoring checks:
  - Public S3 buckets / storage exposure
  - Overly permissive security groups / firewall rules
  - IAM misconfigurations (wildcard policies, no MFA)
  - Unencrypted data stores
  - Exposed cloud metadata endpoints

On-Premise monitoring checks:
  - Unpatched OS / services
  - Weak authentication (default creds, no key-based auth)
  - Open management ports (telnet, RDP)
  - Missing network segmentation
  - Disabled audit logging

Hybrid monitoring checks:
  - VPN / tunnel misconfigurations
  - Cross-environment traffic anomalies
  - Certificate expiration
  - DNS configuration drift
  - Inconsistent firewall rules between environments

All monitoring is simulated — no real infrastructure calls.
Continuous operation: loops never stop until stop() is called.
"""

import asyncio
import logging
import random
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from core.event_bus import event_bus

logger = logging.getLogger(__name__)


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


@dataclass
class EnvironmentAlert:
    """A security alert from environment monitoring."""
    alert_id: str
    environment: str
    category: str
    severity: str
    title: str
    description: str
    resource: str
    recommendation: str
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "environment": self.environment,
            "category": self.category,
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "resource": self.resource,
            "recommendation": self.recommendation,
            "timestamp": self.timestamp,
        }


# ---------------------------------------------------------------------------
# Alert templates per environment
# ---------------------------------------------------------------------------

_CLOUD_ALERTS = [
    {
        "category": "storage",
        "severity": "critical",
        "title": "Public S3 bucket detected",
        "description": "Bucket 'app-data-prod' has public read ACL enabled",
        "resource": "s3://app-data-prod",
        "recommendation": "Remove public ACL; apply bucket policy with explicit deny on s3:GetObject for *",
    },
    {
        "category": "iam",
        "severity": "high",
        "title": "IAM policy with wildcard actions",
        "description": "Role 'dev-admin' has Action: * on Resource: * — violates least privilege",
        "resource": "iam:role/dev-admin",
        "recommendation": "Scope IAM policy to specific services and resources; enable MFA for console access",
    },
    {
        "category": "network",
        "severity": "high",
        "title": "Security group allows 0.0.0.0/0 on port 22",
        "description": "Security group 'sg-webservers' permits SSH from any IP",
        "resource": "ec2:sg/sg-webservers",
        "recommendation": "Restrict SSH to VPN CIDR or bastion host IP only",
    },
    {
        "category": "encryption",
        "severity": "high",
        "title": "Unencrypted RDS instance",
        "description": "RDS instance 'prod-db' does not have encryption at rest enabled",
        "resource": "rds:instance/prod-db",
        "recommendation": "Enable encryption at rest; create encrypted snapshot and restore",
    },
    {
        "category": "metadata",
        "severity": "critical",
        "title": "Cloud metadata endpoint exposed",
        "description": "EC2 instance metadata v1 accessible — SSRF risk for credential theft",
        "resource": "ec2:instance/i-0abc123",
        "recommendation": "Enforce IMDSv2 (require token); block metadata endpoint from application layer",
    },
    {
        "category": "logging",
        "severity": "medium",
        "title": "CloudTrail logging disabled",
        "description": "CloudTrail is not enabled in us-west-2 region",
        "resource": "cloudtrail:us-west-2",
        "recommendation": "Enable CloudTrail with multi-region logging and S3 delivery",
    },
]

_ONPREM_ALERTS = [
    {
        "category": "authentication",
        "severity": "critical",
        "title": "Default credentials on database",
        "description": "MySQL on 192.168.1.13:3306 accepts root login with default password",
        "resource": "192.168.1.13:3306/mysql",
        "recommendation": "Change root password; disable remote root login; enforce password policy",
    },
    {
        "category": "patching",
        "severity": "high",
        "title": "OS kernel outdated",
        "description": "Server 192.168.1.10 running kernel 5.4.0 — 47 known CVEs",
        "resource": "192.168.1.10/kernel",
        "recommendation": "Apply pending kernel updates; schedule reboot for maintenance window",
    },
    {
        "category": "network",
        "severity": "critical",
        "title": "Telnet service running",
        "description": "Telnet daemon active on 192.168.1.17:23 — cleartext protocol",
        "resource": "192.168.1.17:23/telnet",
        "recommendation": "Disable telnet; migrate to SSH; block port 23 at firewall",
    },
    {
        "category": "segmentation",
        "severity": "high",
        "title": "No network segmentation",
        "description": "Database subnet 192.168.1.0/24 is directly reachable from DMZ",
        "resource": "192.168.1.0/24",
        "recommendation": "Implement VLAN segmentation; add firewall rules between zones",
    },
    {
        "category": "audit",
        "severity": "medium",
        "title": "Audit logging disabled",
        "description": "Server 192.168.1.11 has auditd service stopped",
        "resource": "192.168.1.11/auditd",
        "recommendation": "Enable and start auditd; configure rules for privileged commands",
    },
    {
        "category": "authentication",
        "severity": "high",
        "title": "Password-based SSH enabled",
        "description": "SSH on 192.168.1.11:22 allows password authentication",
        "resource": "192.168.1.11:22/ssh",
        "recommendation": "Set PasswordAuthentication no in sshd_config; enforce key-based auth",
    },
]

_HYBRID_ALERTS = [
    {
        "category": "vpn",
        "severity": "high",
        "title": "VPN tunnel using deprecated cipher",
        "description": "Site-to-site VPN uses 3DES cipher — vulnerable to Sweet32 attack",
        "resource": "vpn:tunnel/site-to-cloud",
        "recommendation": "Migrate to AES-256-GCM cipher suite; update both endpoints",
    },
    {
        "category": "certificate",
        "severity": "high",
        "title": "TLS certificate expiring in 7 days",
        "description": "Certificate for *.hybrid.internal expires 2026-04-23",
        "resource": "cert:*.hybrid.internal",
        "recommendation": "Renew certificate; configure auto-renewal via ACME/Let's Encrypt",
    },
    {
        "category": "dns",
        "severity": "medium",
        "title": "DNS configuration drift detected",
        "description": "Internal DNS zone differs between cloud and on-prem resolvers",
        "resource": "dns:zone/internal",
        "recommendation": "Synchronize DNS zones; implement split-horizon DNS properly",
    },
    {
        "category": "firewall",
        "severity": "high",
        "title": "Inconsistent firewall rules",
        "description": "Cloud security group allows port 8080 but on-prem firewall blocks it — service unreachable",
        "resource": "firewall:cross-env/8080",
        "recommendation": "Audit and reconcile firewall rules across environments; use IaC for consistency",
    },
    {
        "category": "traffic",
        "severity": "critical",
        "title": "Anomalous cross-environment traffic",
        "description": "Unusual data transfer from onprem DB to cloud storage (15GB in 1 hour)",
        "resource": "traffic:onprem->cloud",
        "recommendation": "Investigate data exfiltration; check backup schedules; review DLP policies",
    },
    {
        "category": "identity",
        "severity": "high",
        "title": "Federated identity sync failure",
        "description": "LDAP-to-cloud IAM sync failed 3 times — stale credentials may be active",
        "resource": "identity:federation",
        "recommendation": "Fix LDAP connector; force credential rotation for affected accounts",
    },
]


class EnvironmentManager:
    """Monitors Cloud, On-Premise, and Hybrid environments continuously.

    Runs three parallel loops, one per environment type.
    Emits environment_alert and misconfig_found events.

    Usage::

        mgr = EnvironmentManager()
        await mgr.start()  # blocks — runs until stop()
    """

    def __init__(self) -> None:
        self._running: bool = False
        self.alerts: List[EnvironmentAlert] = []
        self.alert_count: int = 0
        self._alert_counter: int = 0
        self._emitted_alerts: Set[str] = set()

        # Per-environment monitoring intervals (seconds)
        self.cloud_interval: float = 6.0
        self.onprem_interval: float = 5.0
        self.hybrid_interval: float = 7.0

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start all three environment monitoring loops in parallel."""
        self._running = True
        ts = _ts()
        print(
            f"{ts} < env_manager: Starting multi-environment monitoring "
            f"(cloud={self.cloud_interval}s, onprem={self.onprem_interval}s, "
            f"hybrid={self.hybrid_interval}s)"
        )

        await asyncio.gather(
            self._monitor_cloud(),
            self._monitor_onprem(),
            self._monitor_hybrid(),
            return_exceptions=True,
        )

    async def stop(self) -> None:
        self._running = False

    # ------------------------------------------------------------------
    # Environment-specific monitoring loops
    # ------------------------------------------------------------------

    async def _monitor_cloud(self) -> None:
        """Continuous cloud environment monitoring."""
        while self._running:
            await self._check_environment("cloud", _CLOUD_ALERTS)
            await asyncio.sleep(self.cloud_interval)

    async def _monitor_onprem(self) -> None:
        """Continuous on-premise environment monitoring."""
        while self._running:
            await self._check_environment("onprem", _ONPREM_ALERTS)
            await asyncio.sleep(self.onprem_interval)

    async def _monitor_hybrid(self) -> None:
        """Continuous hybrid environment monitoring."""
        while self._running:
            await self._check_environment("hybrid", _HYBRID_ALERTS)
            await asyncio.sleep(self.hybrid_interval)

    async def _check_environment(
        self, env_name: str, alert_templates: List[Dict[str, Any]]
    ) -> None:
        """Check one environment for issues. Probabilistically triggers alerts."""
        for template in alert_templates:
            # Each check has a probability of firing per cycle
            # Higher severity = more likely to fire (simulates persistent issues)
            threshold = {"critical": 0.30, "high": 0.25, "medium": 0.15}.get(
                template["severity"], 0.10
            )

            if random.random() > threshold:
                continue

            # Deduplicate: don't re-alert on same issue within a session
            dedup_key = f"{env_name}:{template['category']}:{template['title']}"
            if dedup_key in self._emitted_alerts:
                continue
            self._emitted_alerts.add(dedup_key)

            self._alert_counter += 1
            alert = EnvironmentAlert(
                alert_id=f"ENV-{self._alert_counter:04d}",
                environment=env_name,
                category=template["category"],
                severity=template["severity"],
                title=template["title"],
                description=template["description"],
                resource=template["resource"],
                recommendation=template["recommendation"],
            )
            self.alerts.append(alert)
            self.alert_count += 1

            ts = _ts()
            sev_tag = alert.severity.upper()
            print(
                f"{ts} < env_manager: [{env_name.upper()}] [{sev_tag}] "
                f"{alert.title} — {alert.resource}"
            )

            # Emit to event bus
            await event_bus.emit("environment_alert", alert.to_dict())

            # Critical/high findings also go through misconfig_found for response chain
            if alert.severity in ("critical", "high"):
                await event_bus.emit("misconfig_found", {
                    "environment": env_name,
                    "category": alert.category,
                    "severity": alert.severity,
                    "description": alert.description,
                    "resource": alert.resource,
                    "recommendation": alert.recommendation,
                })

            await asyncio.sleep(0.02)

    # ------------------------------------------------------------------
    # Query API
    # ------------------------------------------------------------------

    def get_alerts(self, environment: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return alerts, optionally filtered by environment."""
        alerts = self.alerts
        if environment:
            alerts = [a for a in alerts if a.environment == environment]
        return [a.to_dict() for a in alerts]

    def get_stats(self) -> Dict[str, Any]:
        """Return monitoring statistics."""
        by_env = {"cloud": 0, "onprem": 0, "hybrid": 0}
        by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        by_category: Dict[str, int] = {}

        for alert in self.alerts:
            by_env[alert.environment] = by_env.get(alert.environment, 0) + 1
            by_severity[alert.severity] = by_severity.get(alert.severity, 0) + 1
            by_category[alert.category] = by_category.get(alert.category, 0) + 1

        return {
            "total_alerts": self.alert_count,
            "by_environment": by_env,
            "by_severity": by_severity,
            "by_category": by_category,
            "monitoring_active": self._running,
        }
