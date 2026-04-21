from __future__ import annotations

"""Real SSH scanner + auto-fixer (two-step flow).

Step 1 — scan():  SSH connect → discover OS → discover ports → detect versions
                   → CVE lookup → build fix plan → return to user for approval.

Step 2 — apply_fixes():  SSH connect → execute approved fix commands → verify.

Every step logs via callbacks so the dashboard shows real-time progress.
"""

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

import paramiko

from blue_agent.scanner.cve_lookup import CVELookup, CVERecord

logger = logging.getLogger(__name__)


def _ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


@dataclass
class DiscoveredService:
    software: str
    version: str
    raw_output: str
    port: Optional[int] = None
    method: str = "command"
    cves: List[CVERecord] = field(default_factory=list)
    fixed: bool = False
    fix_output: str = ""
    proposed_fixes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "software": self.software,
            "version": self.version,
            "raw_output": self.raw_output,
            "port": self.port,
            "method": self.method,
            "cve_count": len(self.cves),
            "cves": [c.to_dict() for c in self.cves],
            "fixed": self.fixed,
            "fix_output": self.fix_output,
            "proposed_fixes": self.proposed_fixes,
        }


# ---------------------------------------------------------------------------
# Version detection commands
# ---------------------------------------------------------------------------

_VERSION_COMMANDS = [
    {"software": "apache", "commands": ["apache2 -v 2>&1", "httpd -v 2>&1", "apachectl -v 2>&1"],
     "pattern": r"Apache/(\d+\.\d+\.\d+)"},
    {"software": "nginx", "commands": ["nginx -v 2>&1"],
     "pattern": r"nginx/(\d+\.\d+\.\d+)"},
    {"software": "mysql", "commands": ["mysql --version 2>&1", "mysqld --version 2>&1"],
     "pattern": r"(\d+\.\d+\.\d+)"},
    {"software": "postgresql", "commands": ["psql --version 2>&1", "postgres --version 2>&1"],
     "pattern": r"(\d+\.\d+\.?\d*)"},
    {"software": "mongodb", "commands": ["mongod --version 2>&1"],
     "pattern": r"v(\d+\.\d+\.\d+)"},
    {"software": "redis", "commands": ["redis-server --version 2>&1"],
     "pattern": r"v=(\d+\.\d+\.\d+)"},
    {"software": "php", "commands": ["php -v 2>&1"],
     "pattern": r"PHP (\d+\.\d+\.\d+)"},
    {"software": "nodejs", "commands": ["node --version 2>&1", "nodejs --version 2>&1"],
     "pattern": r"v?(\d+\.\d+\.\d+)"},
    {"software": "python", "commands": ["python3 --version 2>&1"],
     "pattern": r"Python (\d+\.\d+\.\d+)"},
    {"software": "java", "commands": ["java -version 2>&1"],
     "pattern": r'"(\d+\.\d+[\.\d]*)'},
    {"software": "openssh", "commands": ["ssh -V 2>&1"],
     "pattern": r"OpenSSH_(\d+\.\d+)"},
    {"software": "vsftpd", "commands": ["vsftpd -v 2>&1"],
     "pattern": r"(\d+\.\d+\.\d+)"},
    {"software": "proftpd", "commands": ["proftpd --version 2>&1"],
     "pattern": r"(\d+\.\d+\.\d+)"},
    {"software": "docker", "commands": ["docker --version 2>&1"],
     "pattern": r"(\d+\.\d+\.\d+)"},
    {"software": "elasticsearch", "commands": ["curl -s localhost:9200 2>/dev/null"],
     "pattern": r'"number"\s*:\s*"(\d+\.\d+\.\d+)"'},
    {"software": "tomcat", "commands": ["catalina.sh version 2>/dev/null"],
     "pattern": r"(\d+\.\d+\.\d+)"},
    {"software": "wordpress", "commands": ["wp core version --allow-root 2>/dev/null",
                                            "grep 'wp_version =' /var/www/html/wp-includes/version.php 2>/dev/null"],
     "pattern": r"(\d+\.\d+\.?\d*)"},
]

# ---------------------------------------------------------------------------
# Fix commands per software
# ---------------------------------------------------------------------------

_FIX_COMMANDS: Dict[str, Dict[str, Any]] = {
    "apache": {
        "description": "Upgrade Apache + harden config (disable server tokens, add security headers)",
        "upgrade": ["sudo apt-get update -y", "sudo apt-get install --only-upgrade apache2 -y"],
        "harden": [
            "sudo sed -i 's/ServerTokens OS/ServerTokens Prod/' /etc/apache2/conf-available/security.conf 2>/dev/null || true",
            "sudo sed -i 's/ServerSignature On/ServerSignature Off/' /etc/apache2/conf-available/security.conf 2>/dev/null || true",
            "sudo a2enmod headers 2>/dev/null || true",
            "echo 'Header always set X-Content-Type-Options nosniff' | sudo tee -a /etc/apache2/conf-available/security.conf 2>/dev/null || true",
            "echo 'Header always set X-Frame-Options SAMEORIGIN' | sudo tee -a /etc/apache2/conf-available/security.conf 2>/dev/null || true",
        ],
        "restart": "sudo systemctl restart apache2 2>/dev/null || sudo service apache2 restart 2>/dev/null || true",
    },
    "nginx": {
        "description": "Upgrade Nginx + hide server version",
        "upgrade": ["sudo apt-get update -y", "sudo apt-get install --only-upgrade nginx -y"],
        "harden": ["sudo sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf 2>/dev/null || true"],
        "restart": "sudo systemctl restart nginx 2>/dev/null || sudo service nginx restart 2>/dev/null || true",
    },
    "mysql": {
        "description": "Upgrade MySQL + bind to localhost only",
        "upgrade": ["sudo apt-get update -y", "sudo apt-get install --only-upgrade mysql-server -y 2>/dev/null || sudo apt-get install --only-upgrade mariadb-server -y 2>/dev/null || true"],
        "harden": ["sudo sed -i 's/^bind-address.*/bind-address = 127.0.0.1/' /etc/mysql/mysql.conf.d/mysqld.cnf 2>/dev/null || true"],
        "restart": "sudo systemctl restart mysql 2>/dev/null || sudo service mysql restart 2>/dev/null || true",
    },
    "postgresql": {
        "description": "Upgrade PostgreSQL",
        "upgrade": ["sudo apt-get update -y", "sudo apt-get install --only-upgrade postgresql -y"],
        "harden": [],
        "restart": "sudo systemctl restart postgresql 2>/dev/null || sudo service postgresql restart 2>/dev/null || true",
    },
    "redis": {
        "description": "Upgrade Redis + bind localhost + enable protected mode",
        "upgrade": ["sudo apt-get update -y", "sudo apt-get install --only-upgrade redis-server -y"],
        "harden": [
            "sudo sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf 2>/dev/null || true",
            "sudo sed -i 's/^protected-mode no/protected-mode yes/' /etc/redis/redis.conf 2>/dev/null || true",
        ],
        "restart": "sudo systemctl restart redis 2>/dev/null || sudo service redis-server restart 2>/dev/null || true",
    },
    "php": {
        "description": "Upgrade PHP + disable expose_php and display_errors",
        "upgrade": ["sudo apt-get update -y", "sudo apt-get install --only-upgrade 'php*' -y 2>/dev/null || true"],
        "harden": [
            "sudo sed -i 's/expose_php = On/expose_php = Off/' /etc/php/*/apache2/php.ini 2>/dev/null || true",
            "sudo sed -i 's/display_errors = On/display_errors = Off/' /etc/php/*/apache2/php.ini 2>/dev/null || true",
        ],
        "restart": "sudo systemctl restart apache2 2>/dev/null || true",
    },
    "openssh": {
        "description": "Upgrade OpenSSH + disable root login + limit auth tries",
        "upgrade": ["sudo apt-get update -y", "sudo apt-get install --only-upgrade openssh-server -y"],
        "harden": [
            "sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config 2>/dev/null || true",
            "sudo sed -i 's/^#*MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config 2>/dev/null || true",
        ],
        "restart": "sudo systemctl restart sshd 2>/dev/null || sudo service ssh restart 2>/dev/null || true",
    },
    "nodejs": {
        "description": "Upgrade Node.js to latest stable",
        "upgrade": ["sudo npm install -g n 2>/dev/null && sudo n stable 2>/dev/null || true"],
        "harden": [],
        "restart": "",
    },
    "docker": {
        "description": "Upgrade Docker Engine",
        "upgrade": ["sudo apt-get update -y", "sudo apt-get install --only-upgrade docker-ce -y 2>/dev/null || true"],
        "harden": [],
        "restart": "sudo systemctl restart docker 2>/dev/null || true",
    },
}

_DEFAULT_FIX = {
    "description": "Run apt-get upgrade for this package",
    "upgrade": ["sudo apt-get update -y"],
    "harden": [],
    "restart": "",
}


class SSHScanner:
    """Two-step SSH scanner.

    Step 1: scan()         — discover + CVE lookup + propose fixes
    Step 2: apply_fixes()  — execute approved fixes on the server
    """

    def __init__(self) -> None:
        self.cve_lookup = CVELookup()
        self.last_scan_results: List[DiscoveredService] = []
        self.os_info: str = ""
        self.listening_ports: List[Dict[str, Any]] = []
        self.scan_count: int = 0
        self.fixes_applied: int = 0
        self._log: Optional[Callable] = None
        self._tool: Optional[Callable] = None
        # Stored creds for the fix step
        self._last_host: str = ""
        self._last_port: int = 22
        self._last_user: str = ""
        self._last_pass: str = ""

    # ==================================================================
    # STEP 1: SCAN — discover everything, propose fixes, do NOT apply
    # ==================================================================

    async def scan(
        self,
        host: str,
        ssh_port: int = 22,
        username: str = "root",
        password: str = "",
        log_cb: Optional[Callable] = None,
        tool_cb: Optional[Callable] = None,
    ) -> Dict[str, Any]:
        self._log = log_cb or (lambda msg, **kw: None)
        self._tool = tool_cb or (lambda *a, **kw: None)
        self.scan_count += 1
        start = time.monotonic()

        # Store creds for the apply step
        self._last_host = host
        self._last_port = ssh_port
        self._last_user = username
        self._last_pass = password

        self._log(f"Connecting to {host}:{ssh_port} as {username}...")
        client = await self._connect(host, ssh_port, username, password)
        if not client:
            self._log(f"SSH connection to {host}:{ssh_port} FAILED", level="ERROR")
            self._tool("ssh_connect", {"host": host}, {"error": "connection failed"}, "FAILED")
            return {"success": False, "error": "SSH connection failed", "host": host}

        self._log(f"Connected to {host}:{ssh_port}", level="INFO")
        self._tool("ssh_connect", {"host": host, "port": ssh_port, "user": username}, {"status": "connected"})

        try:
            # Phase 1: OS + ports
            self._log("Phase 1: Discovering OS and system info...")
            self.os_info = await self._gather_os_info(client)
            self._tool("discover_os", {"host": host}, {"os_info": self.os_info[:150]})
            self._log(f"OS: {self.os_info.splitlines()[0] if self.os_info else 'unknown'}")

            self._log("Discovering listening ports...")
            self.listening_ports = await self._discover_ports(client)
            self._tool("discover_ports", {"host": host}, {"count": len(self.listening_ports), "ports": [p["port"] for p in self.listening_ports]})
            self._log(f"Found {len(self.listening_ports)} open ports: {', '.join(str(p['port']) for p in self.listening_ports[:15])}")

            # Phase 2: Versions
            self._log("Phase 2: Detecting software versions...")
            services = await self._detect_all_versions(client)
            self._log(f"Detected {len(services)} software packages")

            # Phase 3: CVE lookup + build fix proposals
            self._log("Phase 3: Looking up CVEs (offline DB + NVD API)...")
            total_cves = 0
            for svc in services:
                cves = await self.cve_lookup.lookup(svc.software, svc.version)
                svc.cves = cves
                total_cves += len(cves)

                if cves:
                    self._log(f"  VULNERABLE: {svc.software} {svc.version} — {len(cves)} CVEs", level="WARN")
                    for cve in cves:
                        self._log(f"    {cve.cve_id} CVSS={cve.cvss_score} ({cve.severity}) — {cve.description[:80]}", level="WARN")
                    self._tool("cve_lookup", {"software": svc.software, "version": svc.version}, {"cve_count": len(cves), "cves": [c.cve_id for c in cves]})

                    # Build proposed fixes list
                    fix_def = _FIX_COMMANDS.get(svc.software, _DEFAULT_FIX)
                    svc.proposed_fixes = []
                    svc.proposed_fixes.append(f"[{svc.software}] {fix_def['description']}")
                    for cmd in fix_def.get("upgrade", []):
                        svc.proposed_fixes.append(f"  $ {cmd}")
                    for cmd in fix_def.get("harden", []):
                        svc.proposed_fixes.append(f"  $ {cmd}")
                    restart = fix_def.get("restart", "")
                    if restart:
                        svc.proposed_fixes.append(f"  $ {restart}")
                else:
                    self._log(f"  CLEAN: {svc.software} {svc.version}")

            self._log(f"CVE scan complete: {total_cves} vulnerabilities found")

            vulnerable = [s for s in services if s.cves]
            if vulnerable:
                self._log(f"--- FIX PLAN: {len(vulnerable)} services need patching ---", level="WARN")
                for svc in vulnerable:
                    for line in svc.proposed_fixes:
                        self._log(f"  {line}", level="WARN")
                self._log("Click APPLY FIXES to execute the above on the server.", level="WARN")
                self._tool("fix_plan", {"host": host}, {
                    "vulnerable_count": len(vulnerable),
                    "plan": [{"software": s.software, "fixes": s.proposed_fixes} for s in vulnerable],
                })
            else:
                self._log("All services are clean — no fixes needed.")

            self.last_scan_results = services
            elapsed = time.monotonic() - start

            self._log(f"Scan finished in {elapsed:.1f}s")
            self._tool("scan_complete", {"host": host}, {
                "services": len(services), "cves": total_cves, "elapsed": f"{elapsed:.1f}s",
            })

            return {
                "success": True,
                "host": host,
                "os_info": self.os_info,
                "listening_ports": self.listening_ports,
                "services": [s.to_dict() for s in services],
                "total_services": len(services),
                "total_cves": total_cves,
                "fixes_applied": 0,
                "elapsed_seconds": round(elapsed, 2),
            }
        finally:
            self._close(client)

    # ==================================================================
    # STEP 2: APPLY FIXES — user approved, now execute
    # ==================================================================

    async def apply_fixes(
        self,
        log_cb: Optional[Callable] = None,
        tool_cb: Optional[Callable] = None,
    ) -> Dict[str, Any]:
        self._log = log_cb or (lambda msg, **kw: None)
        self._tool = tool_cb or (lambda *a, **kw: None)

        vulnerable = [s for s in self.last_scan_results if s.cves and not s.fixed]
        if not vulnerable:
            self._log("No vulnerable services to fix.")
            return {"success": True, "fixes_applied": 0}

        host = self._last_host
        self._log(f"Reconnecting to {host}:{self._last_port} to apply fixes...")
        client = await self._connect(host, self._last_port, self._last_user, self._last_pass)
        if not client:
            self._log("SSH reconnection FAILED", level="ERROR")
            return {"success": False, "error": "SSH reconnect failed", "fixes_applied": 0}

        self._log(f"Connected. Applying fixes for {len(vulnerable)} services...", level="WARN")
        fixes_count = 0

        try:
            for svc in vulnerable:
                sw = svc.software
                fix_def = _FIX_COMMANDS.get(sw, _DEFAULT_FIX)
                all_output: List[str] = []

                self._log(f"Fixing {sw} {svc.version}...", level="WARN")
                self._tool("apply_fix", {"software": sw, "host": host, "cves": [c.cve_id for c in svc.cves]}, {})

                for cmd in fix_def.get("upgrade", []):
                    self._log(f"  $ {cmd}")
                    out = await self._exec(client, cmd, timeout=60)
                    if out:
                        lines = [l for l in out.splitlines() if l.strip()]
                        if lines:
                            self._log(f"    {lines[-1][:120]}")
                        all_output.append(out)

                for cmd in fix_def.get("harden", []):
                    self._log(f"  $ {cmd}")
                    out = await self._exec(client, cmd, timeout=15)
                    all_output.append(out or "")

                restart_cmd = fix_def.get("restart", "")
                if restart_cmd:
                    self._log(f"  $ {restart_cmd}")
                    out = await self._exec(client, restart_cmd, timeout=15)
                    all_output.append(out or "")

                svc.fixed = True
                svc.fix_output = "\n".join(filter(None, all_output))[-500:]
                fixes_count += 1
                self.fixes_applied += 1

                self._log(f"FIXED: {sw} — upgrade + hardening applied", level="INFO")
                self._tool("fix_applied", {"software": sw, "host": host}, {"status": "fixed", "cves_addressed": [c.cve_id for c in svc.cves]})

            # Verify
            self._log("Verifying fixes — re-checking versions...")
            for svc in vulnerable:
                if not svc.fixed:
                    continue
                for entry in _VERSION_COMMANDS:
                    if entry["software"] == svc.software:
                        for cmd in entry["commands"]:
                            out = await self._exec(client, cmd)
                            if out:
                                match = re.search(entry["pattern"], out)
                                if match:
                                    new_ver = match.group(1)
                                    if new_ver != svc.version:
                                        self._log(f"  VERIFIED: {svc.software} upgraded {svc.version} -> {new_ver}")
                                        self._tool("verify_fix", {"software": svc.software}, {"old": svc.version, "new": new_ver})
                                    else:
                                        self._log(f"  {svc.software} version unchanged ({new_ver}) — hardening applied")
                                    break
                        break

            self._log(f"All fixes applied: {fixes_count} services patched.", level="INFO")
            self._tool("fixes_complete", {"host": host}, {"fixes_applied": fixes_count})

            return {
                "success": True,
                "fixes_applied": fixes_count,
                "services": [s.to_dict() for s in self.last_scan_results],
            }
        finally:
            self._close(client)

    # ------------------------------------------------------------------
    # SSH helpers (pass client explicitly — no shared state)
    # ------------------------------------------------------------------

    async def _connect(self, host: str, port: int, username: str, password: str) -> Optional[paramiko.SSHClient]:
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: client.connect(
                hostname=host, port=port, username=username, password=password,
                timeout=10, look_for_keys=False, allow_agent=False,
            ))
            return client
        except Exception as exc:
            logger.error(f"SSH connect failed: {exc}")
            return None

    def _close(self, client: Optional[paramiko.SSHClient]) -> None:
        if client:
            try:
                client.close()
            except Exception:
                pass

    async def _exec(self, client: paramiko.SSHClient, command: str, timeout: int = 15) -> str:
        try:
            loop = asyncio.get_event_loop()
            def _run():
                _, stdout, stderr = client.exec_command(command, timeout=timeout)
                out = stdout.read().decode("utf-8", errors="replace").strip()
                err = stderr.read().decode("utf-8", errors="replace").strip()
                return out or err
            return await loop.run_in_executor(None, _run)
        except Exception as exc:
            logger.debug(f"Command '{command}' failed: {exc}")
            return ""

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    async def _gather_os_info(self, client) -> str:
        results = []
        for cmd in ["cat /etc/os-release 2>/dev/null", "uname -a"]:
            out = await self._exec(client, cmd)
            if out:
                results.append(out)
        return "\n".join(results)

    async def _discover_ports(self, client) -> List[Dict[str, Any]]:
        out = await self._exec(client, "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null")
        ports, seen = [], set()
        if out:
            for line in out.splitlines():
                match = re.search(r':(\d+)\s', line)
                if match:
                    p = int(match.group(1))
                    if p in seen:
                        continue
                    seen.add(p)
                    proc_match = re.search(r'users:\(\("([^"]+)"', line)
                    ports.append({"port": p, "process": proc_match.group(1) if proc_match else ""})
        return ports

    async def _detect_all_versions(self, client) -> List[DiscoveredService]:
        services = []
        for entry in _VERSION_COMMANDS:
            for cmd in entry["commands"]:
                output = await self._exec(client, cmd)
                if not output:
                    continue
                match = re.search(entry["pattern"], output)
                if match:
                    version = match.group(1)
                    port = self._guess_port(entry["software"])
                    services.append(DiscoveredService(
                        software=entry["software"], version=version,
                        raw_output=output[:200], port=port,
                    ))
                    self._log(f"  Found: {entry['software']} {version}")
                    self._tool("detect_version", {"software": entry["software"]}, {"version": version, "port": port})
                    break
        return services

    @staticmethod
    def _guess_port(software: str) -> Optional[int]:
        return {"apache": 80, "nginx": 80, "mysql": 3306, "postgresql": 5432,
                "mongodb": 27017, "redis": 6379, "elasticsearch": 9200,
                "openssh": 22, "vsftpd": 21, "proftpd": 21, "tomcat": 8080,
                "docker": 2375, "php": 9000, "nodejs": 3000}.get(software)

    # ------------------------------------------------------------------
    # Query API
    # ------------------------------------------------------------------

    def get_results(self) -> List[Dict[str, Any]]:
        return [s.to_dict() for s in self.last_scan_results]

    def get_stats(self) -> Dict[str, Any]:
        total_cves = sum(len(s.cves) for s in self.last_scan_results)
        vulnerable = sum(1 for s in self.last_scan_results if s.cves)
        fixed = sum(1 for s in self.last_scan_results if s.fixed)
        return {
            "scan_count": self.scan_count,
            "services_found": len(self.last_scan_results),
            "vulnerable_services": vulnerable,
            "total_cves": total_cves,
            "fixes_applied": self.fixes_applied,
            "fixed_this_scan": fixed,
            "os_info": self.os_info[:200] if self.os_info else "",
            "listening_ports_count": len(self.listening_ports),
        }
