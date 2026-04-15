"""Jira MCP Server - FastMCP instance with health check."""

from fastapi import FastAPI

app = FastAPI(
    title="Jira MCP Server",
    description="MCP Server for Jira integration",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "jira"}
