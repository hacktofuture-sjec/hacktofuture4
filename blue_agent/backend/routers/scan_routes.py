"""Asset scanning and CVE lookup endpoints for the Blue Agent."""

from typing import List, Optional

from fastapi import APIRouter

from blue_agent.backend.schemas.blue_schemas import (
    AssetInfo,
    SSHCredentials,
    SSHScanResult,
    ScanRequest,
    ScanResult,
    VulnerabilityInfo,
)
from blue_agent.backend.services import blue_service

router = APIRouter()


@router.get("/inventory", response_model=List[AssetInfo])
async def get_inventory(environment: Optional[str] = None) -> List[AssetInfo]:
    """Return the full asset inventory, optionally filtered by environment."""
    return await blue_service.get_asset_inventory(environment=environment)


@router.get("/vulnerable", response_model=List[AssetInfo])
async def get_vulnerable_assets() -> List[AssetInfo]:
    """Return only assets with known CVEs."""
    return await blue_service.get_vulnerable_assets()


@router.get("/stats")
async def get_scan_stats() -> dict:
    """Return scan statistics."""
    return await blue_service.get_scan_stats()


@router.get("/vulnerabilities", response_model=List[VulnerabilityInfo])
async def get_all_vulnerabilities() -> List[VulnerabilityInfo]:
    """Return all discovered vulnerabilities across all assets."""
    return await blue_service.get_all_vulnerabilities()


@router.post("/ssh", response_model=SSHScanResult)
async def ssh_scan(creds: SSHCredentials) -> SSHScanResult:
    """Connect to a server via SSH, discover all software, lookup CVEs."""
    result = await blue_service.run_ssh_scan(
        host=creds.host,
        ssh_port=creds.ssh_port,
        username=creds.username,
        password=creds.password,
    )
    return SSHScanResult(**result)


@router.post("/ssh/apply-fixes")
async def apply_fixes() -> dict:
    """Apply the proposed fixes from the last scan."""
    return await blue_service.apply_ssh_fixes()


@router.get("/ssh/results")
async def ssh_scan_results() -> list:
    """Return results from the last SSH scan."""
    return blue_service.get_ssh_scan_results()


@router.get("/ssh/stats")
async def ssh_scan_stats() -> dict:
    """Return SSH scan statistics."""
    return blue_service.get_ssh_scan_stats()
