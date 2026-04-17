"""
HubSpot MCP Server — FastMCP-based tools for CRM data ingestion.

Tools:
  - get_contacts: paginated contact list
  - get_deals: paginated deal list
  - get_deal_by_id: single deal lookup

Auth: HUBSPOT_API_KEY env var (Bearer token).
"""

import logging
import os

import httpx
from fastmcp import FastMCP

logger = logging.getLogger(__name__)

app = FastMCP(
    name="HubSpot MCP Server",
    description="MCP tools for HubSpot CRM — contacts, deals, pipelines.",
)

HUBSPOT_BASE_URL = "https://api.hubapi.com"
_API_KEY = os.getenv("HUBSPOT_API_KEY", "")


def _headers() -> dict:
    if not _API_KEY:
        raise RuntimeError("HUBSPOT_API_KEY env var is not set")
    return {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
    }


@app.tool()
async def health_check() -> dict:
    """Returns server health. Does NOT call HubSpot API."""
    return {
        "status": "ok",
        "service": "hubspot-mcp",
        "api_key_configured": bool(_API_KEY),
    }


@app.tool()
async def get_contacts(limit: int = 50, after: str = "") -> dict:
    """
    Fetch a paginated list of HubSpot contacts.

    Args:
        limit: Max records to return (1–100).
        after: Paging cursor from previous response.

    Returns:
        {results, paging} as returned by HubSpot Contacts API v3.
    """
    limit = max(1, min(limit, 100))
    params: dict = {
        "limit": limit,
        "properties": "firstname,lastname,email,phone,company,createdate,lastmodifieddate",
    }
    if after:
        params["after"] = after

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{HUBSPOT_BASE_URL}/crm/v3/objects/contacts",
            headers=_headers(),
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    logger.info("[hubspot] get_contacts → %d results", len(data.get("results", [])))
    return {
        "results": data.get("results", []),
        "paging": data.get("paging"),
        "total": len(data.get("results", [])),
    }


@app.tool()
async def get_deals(limit: int = 50, after: str = "") -> dict:
    """
    Fetch a paginated list of HubSpot deals.

    Args:
        limit: Max records to return (1–100).
        after: Paging cursor from previous response.

    Returns:
        {results, paging} with deal stage, amount, close_date.
    """
    limit = max(1, min(limit, 100))
    params: dict = {
        "limit": limit,
        "properties": "dealname,dealstage,amount,closedate,pipeline,createdate,hs_lastmodifieddate",
    }
    if after:
        params["after"] = after

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{HUBSPOT_BASE_URL}/crm/v3/objects/deals",
            headers=_headers(),
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    logger.info("[hubspot] get_deals → %d results", len(data.get("results", [])))
    return {
        "results": data.get("results", []),
        "paging": data.get("paging"),
        "total": len(data.get("results", [])),
    }


@app.tool()
async def get_deal_by_id(deal_id: str) -> dict:
    """
    Fetch a single HubSpot deal by its object ID.

    Args:
        deal_id: HubSpot deal object ID.

    Returns:
        Full deal properties object.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{HUBSPOT_BASE_URL}/crm/v3/objects/deals/{deal_id}",
            headers=_headers(),
            params={
                "properties": (
                    "dealname,dealstage,amount,closedate,pipeline,"
                    "createdate,hs_lastmodifieddate,hubspot_owner_id"
                )
            },
        )
        resp.raise_for_status()
        data = resp.json()

    logger.info("[hubspot] get_deal_by_id(%s) → found", deal_id)
    return data
