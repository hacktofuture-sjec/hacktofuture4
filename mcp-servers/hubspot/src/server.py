"""HubSpot MCP Server - FastMCP instance with health check."""

from fastmcp import FastMCP

app = FastMCP(
    name="HubSpot MCP Server",
    description="MCP Server for HubSpot integration",
)


@app.tool()
async def health_check() -> dict:
    """Health check tool."""
    return {"status": "ok", "service": "hubspot"}
