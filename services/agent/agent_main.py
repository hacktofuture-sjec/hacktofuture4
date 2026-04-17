"""
VoxBridge LiveKit Agent -- Phase 2 skeleton.
Handles: Audio ingestion -> Semantic VAD -> Deepgram STT -> transcript to console.
"""
import os
import asyncio
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import deepgram
from livekit.agents.voice import MetricsCollectedEvent

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
LIVEKIT_API_KEY = os.environ["LIVEKIT_API_KEY"]
LIVEKIT_API_SECRET = os.environ["LIVEKIT_API_SECRET"]
DEEPGRAM_API_KEY = os.environ["DEEPGRAM_API_KEY"]


class VoxBridgeAgent(Agent):
    """Core VoxBridge agent -- Phase 2: STT only."""

    def __init__(self):
        super().__init__(instructions="You are VoxBridge, a voice support agent.")

    async def on_user_turn_completed(self, turn_ctx, new_message):
        """Called when Deepgram returns final transcript."""
        transcript = new_message.content
        print(f"[STT] Final transcript: {transcript}")
        # Phase 3: Pass transcript to LLM + RAG pipeline here


async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()

    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            api_key=DEEPGRAM_API_KEY,
            language="en-US",
        ),
        # Phase 3: Add LLM and TTS here
        # Phase 2: Use LiveKit Semantic Turn Detection
        turn_detection=agents.turn_detector.EOUModel(),  # Semantic transformer model
    )

    await session.start(
        room=ctx.room,
        agent=VoxBridgeAgent(),
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
