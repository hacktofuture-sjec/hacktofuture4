"""Network discovery tool wrappers.

arp-scan, rustscan, nmap-advanced, masscan, enum4linux-ng, nbtscan, smbmap,
rpcclient. Each is an independent subprocess — no sequential chain.
"""

from __future__ import annotations

import socket

from .. import parsers
from ..config import TOOLS
from ..runner import run


def _binary(name: str) -> str:
    spec = TOOLS[name]
    resolved = spec.resolve()
    if not resolved:
        raise RuntimeError(f"{name} not installed (run install.sh)")
    return resolved


def _resolve(target: str) -> str:
    """Return an IP string for a hostname / IP / CIDR target.

    masscan and a few other raw-socket tools reject hostnames outright,
    so we do the DNS lookup ourselves. CIDR strings and already-numeric
    targets pass through unchanged.
    """
    if "/" in target or target.replace(".", "").replace(":", "").isdigit():
        return target
    try:
        return socket.gethostbyname(target)
    except socket.gaierror:
        return target


async def arp_scan_impl(cidr: str | None = None, local_network: bool = True) -> dict:
    cmd = [_binary("arp-scan"), "-q"]
    if local_network and not cidr:
        cmd.append("--localnet")
    else:
        cmd.append(cidr or "--localnet")
    raw = await run(cmd, timeout=TOOLS["arp-scan"].default_timeout)
    return parsers.parse_arp_scan(raw, cidr or "localnet")


async def rustscan_impl(
    target: str,
    ulimit: int = 5000,
    scripts: bool = False,
) -> dict:
    cmd = [
        _binary("rustscan"),
        "-a", target,
        "--ulimit", str(ulimit),
        "--no-config",
        "--greppable",
    ]
    if not scripts:
        cmd.append("--scripts")
        cmd.append("None")
    raw = await run(cmd, timeout=TOOLS["rustscan"].default_timeout)
    return parsers.parse_rustscan(raw, target)


async def nmap_advanced_impl(
    target: str,
    scan_type: str = "-sS",
    os_detection: bool = False,
    version_detection: bool = True,
) -> dict:
    # OS detection is off by default because `-O` adds 1–3 minutes per
    # host, which kills interactive responsiveness. The agent can pass
    # os_detection=True when it actually wants fingerprinting.
    cmd = [_binary("nmap"), *scan_type.split()]
    if os_detection:
        cmd.append("-O")
    if version_detection:
        cmd.append("-sV")
    cmd += ["-oX", "-", target]
    raw = await run(cmd, timeout=TOOLS["nmap"].default_timeout)
    out = parsers.parse_nmap(raw, target)
    out["tool"] = "nmap-advanced"
    return out


async def masscan_impl(
    target: str,
    rate: int = 1000,
    ports: str = "80,443,22,21,25,3389,8080,8443",
    banners: bool = False,
) -> dict:
    # masscan rejects hostnames — resolve to IP first. We also ship a
    # narrower default port list than the full 1-65535 range; at rate=1000
    # that was pushing 60+ seconds per host which is bad for smoke tests.
    ip_target = _resolve(target)
    cmd = [
        _binary("masscan"),
        ip_target,
        "-p", ports,
        "--rate", str(rate),
        "-oJ", "-",
    ]
    if banners:
        cmd.append("--banners")
    raw = await run(cmd, timeout=TOOLS["masscan"].default_timeout)
    return parsers.parse_masscan(raw, target)


async def enum4linux_ng_impl(
    target: str,
    shares: bool = True,
    users: bool = True,
    groups: bool = True,
) -> dict:
    cmd = [_binary("enum4linux-ng"), "-oJ", "-"]
    if shares:
        cmd.append("-S")
    if users:
        cmd.append("-U")
    if groups:
        cmd.append("-G")
    cmd.append(target)
    raw = await run(cmd, timeout=TOOLS["enum4linux-ng"].default_timeout)
    return parsers.parse_enum4linux_ng(raw, target)


async def nbtscan_impl(target: str, verbose: bool = True) -> dict:
    cmd = [_binary("nbtscan")]
    if verbose:
        cmd.append("-v")
    cmd.append(target)
    raw = await run(cmd, timeout=TOOLS["nbtscan"].default_timeout)
    return parsers.parse_nbtscan(raw, target)


async def smbmap_impl(target: str, recursive: bool = False) -> dict:
    # smbmap 1.10 changed `-R` semantics: it now takes a share name as
    # argument rather than being a boolean flag. Default to a plain
    # enumeration; agents that want recursion can pass the share name
    # via a future param.
    cmd = [_binary("smbmap"), "-H", target, "-u", "", "-p", ""]
    raw = await run(cmd, timeout=TOOLS["smbmap"].default_timeout)
    return parsers.parse_smbmap(raw, target)


async def rpcclient_impl(
    target: str,
    commands: str = "enumdomusers;enumdomgroups;querydominfo",
) -> dict:
    cmd = [
        _binary("rpcclient"),
        "-U", "",
        "-N",
        "-c", commands,
        target,
    ]
    raw = await run(cmd, timeout=TOOLS["rpcclient"].default_timeout)
    return parsers.parse_rpcclient(raw, target)
