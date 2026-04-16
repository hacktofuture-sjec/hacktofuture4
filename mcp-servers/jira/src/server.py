"""
Jira MCP Server — FastMCP tools for issue and project ingestion.

Tools:
  - health_check
  - search_issues: JQL-based paginated search
  - get_issue: single issue by key
  - get_projects: list all accessible projects

Auth: JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN (Basic Auth).
"""

import base64
import logging
import os

import httpx
from fastmcp import FastMCP

logger = logging.getLogger(__name__)

app = FastMCP(
    name="Jira MCP Server",
    description="MCP tools for Jira — issues, projects, JQL search.",
)

_JIRA_BASE_URL = os.getenv("JIRA_BASE_URL", "").rstrip("/")
_JIRA_EMAIL = os.getenv("JIRA_EMAIL", "")
_JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "")


def _headers() -> dict:
    if not all([_JIRA_BASE_URL, _JIRA_EMAIL, _JIRA_API_TOKEN]):
        raise RuntimeError(
            "JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN must all be set"
        )
    credentials = base64.b64encode(f"{_JIRA_EMAIL}:{_JIRA_API_TOKEN}".encode()).decode()
    return {
        "Authorization": f"Basic {credentials}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


@app.tool()
async def health_check() -> dict:
    """Returns MCP server health. Does NOT call Jira API."""
    return {
        "status": "ok",
        "service": "jira-mcp",
        "base_url_configured": bool(_JIRA_BASE_URL),
        "credentials_configured": bool(_JIRA_EMAIL and _JIRA_API_TOKEN),
    }


@app.tool()
async def search_issues(
    jql: str = "ORDER BY created DESC",
    limit: int = 50,
    start_at: int = 0,
    fields: str = (
        "summary,status,issuetype,priority,assignee,reporter,"
        "created,updated,duedate,labels,description"
    ),
) -> dict:
    """
    Search Jira issues via JQL.

    Args:
        jql: JQL query string.
        limit: Max results (1–100).
        start_at: Pagination offset.
        fields: Comma-separated fields to return.

    Returns:
        {issues, total, maxResults, startAt}
    """
    limit = max(1, min(limit, 100))
    payload = {
        "jql": jql,
        "maxResults": limit,
        "startAt": start_at,
        "fields": fields.split(","),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_JIRA_BASE_URL}/rest/api/3/search",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    logger.info(
        "[jira] search_issues jql=%r → %d/%d results",
        jql,
        len(data.get("issues", [])),
        data.get("total", 0),
    )
    return {
        "issues": data.get("issues", []),
        "total": data.get("total", 0),
        "maxResults": data.get("maxResults", limit),
        "startAt": data.get("startAt", start_at),
    }


@app.tool()
async def get_issue(issue_key: str) -> dict:
    """
    Fetch a single Jira issue by its key (e.g. PROJ-123).

    Args:
        issue_key: Jira issue key.

    Returns:
        Full issue object including all fields.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_JIRA_BASE_URL}/rest/api/3/issue/{issue_key}",
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()

    logger.info("[jira] get_issue(%s) → found", issue_key)
    return data


@app.tool()
async def get_projects(limit: int = 50, start_at: int = 0) -> dict:
    """
    List all accessible Jira projects.

    Args:
        limit: Max results (1–50).
        start_at: Pagination offset.

    Returns:
        {projects, total, isLast}
    """
    limit = max(1, min(limit, 50))
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_JIRA_BASE_URL}/rest/api/3/project/search",
            headers=_headers(),
            params={
                "maxResults": limit,
                "startAt": start_at,
                "expand": "description,lead",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    logger.info(
        "[jira] get_projects → %d projects (total=%d)",
        len(data.get("values", [])),
        data.get("total", 0),
    )
    return {
        "projects": data.get("values", []),
        "total": data.get("total", 0),
        "isLast": data.get("isLast", True),
    }
