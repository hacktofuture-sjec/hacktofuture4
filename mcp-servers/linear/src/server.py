"""
Linear MCP Server — FastMCP tools for issue ingestion from Linear.

Tools:
  - health_check
  - get_issues: paginated issue list with optional team filter
  - get_issue_by_id: single issue by Linear UUID
  - get_teams: list all teams in the workspace

Auth: LINEAR_API_KEY env var (Bearer token via GraphQL API).
"""

import logging
import os

import httpx
from fastmcp import FastMCP

logger = logging.getLogger(__name__)

app = FastMCP(
    name="Linear MCP Server",
    description="MCP tools for Linear — issues, teams, priorities.",
)

LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql"
_API_KEY = os.getenv("LINEAR_API_KEY", "")


def _headers() -> dict:
    if not _API_KEY:
        raise RuntimeError("LINEAR_API_KEY env var is not set")
    return {
        "Authorization": _API_KEY,
        "Content-Type": "application/json",
    }


@app.tool()
async def health_check() -> dict:
    """Returns MCP server health. Does NOT call Linear API."""
    return {
        "status": "ok",
        "service": "linear-mcp",
        "api_key_configured": bool(_API_KEY),
    }


@app.tool()
async def get_issues(
    team_id: str = "",
    limit: int = 50,
    after_cursor: str = "",
) -> dict:
    """
    Fetch a paginated list of Linear issues.

    Args:
        team_id: Filter to a specific team UUID (optional).
        limit: Max results (1–100).
        after_cursor: Pagination cursor from previous response.

    Returns:
        {issues, pageInfo} with nodes containing id, title, state, priority, etc.
    """
    limit = max(1, min(limit, 100))

    filter_clause = f'filter: {{team: {{id: {{eq: "{team_id}"}}}}}},' if team_id else ""
    after_clause = f'after: "{after_cursor}",' if after_cursor else ""

    query = f"""
    query {{
      issues({filter_clause} first: {limit}, {after_clause} orderBy: updatedAt) {{
        nodes {{
          id
          identifier
          title
          description
          state {{
            id
            name
            type
          }}
          priority
          priorityLabel
          assignee {{
            id
            name
            email
          }}
          team {{
            id
            name
            key
          }}
          labels {{
            nodes {{
              id
              name
            }}
          }}
          dueDate
          createdAt
          updatedAt
        }}
        pageInfo {{
          hasNextPage
          endCursor
        }}
      }}
    }}
    """

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            LINEAR_GRAPHQL_URL,
            headers=_headers(),
            json={"query": query},
        )
        resp.raise_for_status()
        data = resp.json()

    if "errors" in data:
        logger.error("[linear] GraphQL errors: %s", data["errors"])
        raise ValueError(f"Linear GraphQL error: {data['errors']}")

    issues_data = data.get("data", {}).get("issues", {})
    nodes = issues_data.get("nodes", [])
    logger.info("[linear] get_issues → %d issues", len(nodes))
    return {
        "issues": nodes,
        "pageInfo": issues_data.get("pageInfo", {}),
        "total": len(nodes),
    }


@app.tool()
async def get_issue_by_id(issue_id: str) -> dict:
    """
    Fetch a single Linear issue by its UUID.

    Args:
        issue_id: Linear issue UUID.

    Returns:
        Full issue object.
    """
    query = f"""
    query {{
      issue(id: "{issue_id}") {{
        id
        identifier
        title
        description
        state {{
          id
          name
          type
        }}
        priority
        priorityLabel
        assignee {{
          id
          name
          email
        }}
        team {{
          id
          name
          key
        }}
        labels {{
          nodes {{
            id
            name
          }}
        }}
        dueDate
        createdAt
        updatedAt
        comments {{
          nodes {{
            id
            body
            createdAt
            user {{
              id
              name
            }}
          }}
        }}
      }}
    }}
    """

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            LINEAR_GRAPHQL_URL,
            headers=_headers(),
            json={"query": query},
        )
        resp.raise_for_status()
        data = resp.json()

    if "errors" in data:
        raise ValueError(f"Linear GraphQL error: {data['errors']}")

    issue = data.get("data", {}).get("issue")
    if not issue:
        raise ValueError(f"Issue {issue_id} not found")

    logger.info("[linear] get_issue_by_id(%s) → %s", issue_id, issue.get("identifier"))
    return issue


@app.tool()
async def get_teams() -> dict:
    """
    List all teams in the Linear workspace.

    Returns:
        {teams: [{id, name, key, description}]}
    """
    query = """
    query {
      teams {
        nodes {
          id
          name
          key
          description
          membersCount: members { nodes { id } }
        }
      }
    }
    """

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            LINEAR_GRAPHQL_URL,
            headers=_headers(),
            json={"query": query},
        )
        resp.raise_for_status()
        data = resp.json()

    if "errors" in data:
        raise ValueError(f"Linear GraphQL error: {data['errors']}")

    teams = data.get("data", {}).get("teams", {}).get("nodes", [])
    logger.info("[linear] get_teams → %d teams", len(teams))
    return {"teams": teams, "total": len(teams)}
