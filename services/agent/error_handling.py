"""
Centralized error handling for all pipeline failure modes.
"""
import asyncio
from enum import Enum


class FailureMode(Enum):
    STT_EMPTY = "stt_empty"
    STT_LOW_CONFIDENCE = "stt_low_confidence"
    LLM_TIMEOUT = "llm_timeout"
    TOOL_API_FAILURE = "tool_api_failure"
    GPU_MEMORY_EXCEEDED = "gpu_memory_exceeded"
    DEEPGRAM_QUOTA = "deepgram_quota"
    ELEVENLABS_QUOTA = "elevenlabs_quota"
    TWILIO_DISCONNECT = "twilio_disconnect"


CANNED_RESPONSES = {
    FailureMode.STT_EMPTY: "I'm sorry, I didn't catch that. Could you please repeat?",
    FailureMode.LLM_TIMEOUT: "I'm unable to assist right now. Please hold while I connect you to an agent.",
    FailureMode.TOOL_API_FAILURE: "I encountered an issue completing that request. Let me connect you with a specialist.",
}


class RetryHandler:
    def __init__(self, max_retries: int = 3):
        self.max_retries = max_retries
        self.retry_counts: dict[str, int] = {}

    def should_escalate(self, session_id: str, failure: FailureMode) -> bool:
        key = f"{session_id}_{failure.value}"
        self.retry_counts[key] = self.retry_counts.get(key, 0) + 1
        return self.retry_counts[key] >= self.max_retries

    def get_retry_message(self, failure: FailureMode, attempt: int) -> str:
        return CANNED_RESPONSES.get(failure, "I'm having trouble right now.")
