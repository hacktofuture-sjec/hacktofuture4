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
    params = {
        "jql": jql,
        "maxResults": limit,
        "startAt": start_at,
        "fields": fields,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_JIRA_BASE_URL}/rest/api/3/search/jql",
            headers=_headers(),
            params=params,
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


@app.tool()
async def create_issue(
    project_key: str,
    summary: str,
    issue_type: str = "Task",
    description: str = "",
    priority: str = "Medium",
    assignee_account_id: str = "",
    labels: list[str] | None = None,
) -> dict:
    """
    Create a new Jira issue.

    Args:
        project_key: Project key (e.g. PROJ).
        summary: Issue title / summary.
        issue_type: Type name — Task, Bug, Story, Epic, Sub-task.
        description: Issue description (plain text).
        priority: Priority name — Highest, High, Medium, Low, Lowest.
        assignee_account_id: Atlassian account ID for assignee (optional).
        labels: List of label strings (optional).

    Returns:
        {id, key, self} of the created issue.
    """
    fields: dict = {
        "project": {"key": project_key},
        "summary": summary,
        "issuetype": {"name": issue_type},
        "priority": {"name": priority},
    }
    if description:
        fields["description"] = {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": description}],
                }
            ],
        }
    if assignee_account_id:
        fields["assignee"] = {"accountId": assignee_account_id}
    if labels:
        fields["labels"] = labels

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_JIRA_BASE_URL}/rest/api/3/issue",
            headers=_headers(),
            json={"fields": fields},
        )
        resp.raise_for_status()
        data = resp.json()

    logger.info("[jira] create_issue → %s", data.get("key"))
    return {"id": data["id"], "key": data["key"], "self": data["self"]}


@app.tool()
async def transition_issue(issue_key: str, transition_name: str) -> dict:
    """
    Transition a Jira issue to a new status.

    Args:
        issue_key: Jira issue key (e.g. PROJ-42).
        transition_name: Target status name — e.g. 'Done', 'In Progress', 'To Do'.

    Returns:
        {success, issue_key, transitioned_to}
    """
    # First get available transitions
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_JIRA_BASE_URL}/rest/api/3/issue/{issue_key}/transitions",
            headers=_headers(),
        )
        resp.raise_for_status()
        transitions = resp.json().get("transitions", [])

    target = None
    for t in transitions:
        if t["name"].lower() == transition_name.lower():
            target = t
            break

    if not target:
        available = [t["name"] for t in transitions]
        raise ValueError(
            f"Transition '{transition_name}' not found for {issue_key}. "
            f"Available: {available}"
        )

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_JIRA_BASE_URL}/rest/api/3/issue/{issue_key}/transitions",
            headers=_headers(),
            json={"transition": {"id": target["id"]}},
        )
        resp.raise_for_status()

    logger.info("[jira] transition_issue(%s) → %s", issue_key, transition_name)
    return {
        "success": True,
        "issue_key": issue_key,
        "transitioned_to": transition_name,
    }
