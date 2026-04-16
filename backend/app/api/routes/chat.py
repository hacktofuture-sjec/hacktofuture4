from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.controller.controller import ControllerKernel
from src.memory.three_tier_memory import ThreeTierMemory

router = APIRouter()
kernel = ControllerKernel()
memory = ThreeTierMemory()


class ChatRequest(BaseModel):
    message: str
    session_id: str


class ChatResponse(BaseModel):
    answer: str
    trace_id: str
    needs_approval: bool


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    result = kernel.handle_query(query=payload.message, session_id=payload.session_id)
    return ChatResponse(
        answer=result.answer,
        trace_id=result.trace_id,
        needs_approval=result.needs_approval,
    )


def _to_stream_payload(step: dict) -> dict[str, object]:
    return {
        "step": step.get("step", ""),
        "agent": step.get("agent", ""),
        "observation": step.get("observation", ""),
        "sources": step.get("sources", []),
    }


@router.get("/chat/transcript/{trace_id}")
def get_transcript(trace_id: str) -> dict:
    transcript = memory.get_transcript(trace_id)
    if transcript is None:
        raise HTTPException(status_code=404, detail=f"trace {trace_id} not found")
    return transcript


@router.get("/chat/stream")
async def stream_chat_trace(trace_id: str) -> EventSourceResponse:
    transcript = memory.get_transcript(trace_id)
    if transcript is None:
        raise HTTPException(status_code=404, detail=f"trace {trace_id} not found")

    async def event_generator():
        for step in transcript.get("steps", []):
            yield {
                "event": "trace_step",
                "data": json.dumps(_to_stream_payload(step)),
            }

    return EventSourceResponse(event_generator())
