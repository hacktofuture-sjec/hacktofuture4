"""
VoxBridge LiveKit Agent -- Full Pipeline (Phase 4).
Pipeline: Twilio -> LiveKit -> Semantic VAD -> Deepgram STT -> RAG+LLM+MCP -> ElevenLabs TTS -> Twilio
All stages async-streamed for sub-800ms perceived latency.
"""
import os
import asyncio
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import deepgram, elevenlabs, openai as lk_openai
from fsm import FSMContext, AgentState
from llm_agent import run_llm_turn
from tts_service import synthesize_streaming
from error_handling import RetryHandler, FailureMode, CANNED_RESPONSES

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
LIVEKIT_API_KEY = os.environ["LIVEKIT_API_KEY"]
LIVEKIT_API_SECRET = os.environ["LIVEKIT_API_SECRET"]
DEEPGRAM_API_KEY = os.environ["DEEPGRAM_API_KEY"]
ELEVENLABS_API_KEY = os.environ["ELEVENLABS_API_KEY"]


class VoxBridgeAgent(Agent):
    def __init__(self, tenant_id: str, caller_id: str):
        super().__init__(instructions=self._get_initial_instructions())
        self.fsm = FSMContext(tenant_id=tenant_id, caller_id=caller_id)
        self.retry_handler = RetryHandler(max_retries=3)
        self.session_id = f"{tenant_id}_{caller_id}"

    def _get_initial_instructions(self) -> str:
        return "You are VoxBridge. Greet the caller and ask for their PIN to authenticate."

    async def on_user_turn_completed(self, turn_ctx, new_message):
        transcript = new_message.content

        # Handle empty/low-confidence STT
        if not transcript or len(transcript.strip()) < 2:
            if self.retry_handler.should_escalate(self.session_id, FailureMode.STT_EMPTY):
                self.fsm.transition_to(AgentState.HUMAN_ESCALATION)
                await turn_ctx.say(CANNED_RESPONSES[FailureMode.LLM_TIMEOUT])
            else:
                await turn_ctx.say(CANNED_RESPONSES[FailureMode.STT_EMPTY])
            return

        try:
            # Run LLM with RAG and FSM -- timeout at 2s
            response_text = await asyncio.wait_for(
                run_llm_turn(transcript, self.fsm),
                timeout=2.0
            )
            await turn_ctx.say(response_text)

        except asyncio.TimeoutError:
            print(f"[LLM] Timeout on turn. Session: {self.session_id}")
            await turn_ctx.say(CANNED_RESPONSES[FailureMode.LLM_TIMEOUT])

        except Exception as e:
            print(f"[Agent] Unhandled error: {e}")
            await turn_ctx.say("I'm having a technical issue. Let me connect you to an agent.")
            self.fsm.transition_to(AgentState.HUMAN_ESCALATION)


async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()

    # Extract tenant_id from room metadata or phone number mapping
    tenant_id = ctx.room.metadata or "default_tenant"
    caller_id = "unknown"  # Extract from Twilio metadata

    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            api_key=DEEPGRAM_API_KEY,
            language="en-US",
        ),
        tts=elevenlabs.TTS(
            api_key=ELEVENLABS_API_KEY,
            voice_id="your-voice-id",
            model="eleven_turbo_v2",
        ),
        turn_detection=agents.turn_detector.EOUModel(),  # Semantic transformer -- not silence threshold
    )

    await session.start(
        room=ctx.room,
        agent=VoxBridgeAgent(tenant_id=tenant_id, caller_id=caller_id),
        room_input_options=RoomInputOptions(noise_cancellation=True),
    )


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
            ws_url=LIVEKIT_URL,
        )
    )
