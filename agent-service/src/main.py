"""FastAPI application for the Voice-to-Action agent service."""

from fastapi import FastAPI

app = FastAPI(
    title="Voice-to-Action Agent",
    description="Agent service powered by FastAPI + LangGraph",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "agent"}
