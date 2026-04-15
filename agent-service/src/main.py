"""FastAPI application for the Voice-to-Action agent service."""

from fastapi import FastAPI, Request
from sse_starlette.sse import EventSourceResponse
import asyncio

app = FastAPI(
    title="Voice-to-Action Agent",
    description="Agent service powered by FastAPI + LangGraph",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "agent"}


@app.post("/query")
async def query_endpoint(request: Request):
    """Stubbed query SSE endpoint."""

    async def event_generator():
        yield {
            "event": "reasoning_step",
            "data": '{"step_id": "1", "agent_name": "primary", "status": "started", "description": "Processing query"}',
        }
        await asyncio.sleep(0.1)
        yield {
            "event": "final_answer",
            "data": '{"content": "This is a stubbed response", "sources": []}',
        }

    return EventSourceResponse(event_generator())
