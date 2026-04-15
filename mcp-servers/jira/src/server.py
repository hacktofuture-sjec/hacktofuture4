"""Jira MCP Server - FastMCP instance with health check."""

from fastmcp import FastMCP

app = FastMCP(
    name="Jira MCP Server",
    description="MCP Server for Jira integration",
)


@app.tool()
async def health_check() -> dict:
    """Health check tool."""
    return {"status": "ok", "service": "jira"}
