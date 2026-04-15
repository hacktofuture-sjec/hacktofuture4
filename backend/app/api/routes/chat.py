from fastapi import APIRouter
from pydantic import BaseModel

from src.controller.controller import ControllerKernel

router = APIRouter()
kernel = ControllerKernel()


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
