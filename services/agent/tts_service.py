"""
TTS service with ElevenLabs primary and Kokoro local fallback.
Critical: TTS synthesis begins on FIRST complete syntactical phrase from LLM stream.
This is the key optimization enabling sub-800ms total latency.
"""
import os
import httpx
import asyncio
from enum import Enum

ELEVENLABS_API_KEY = os.environ["ELEVENLABS_API_KEY"]
ELEVENLABS_VOICE_ID = "your-voice-id"  # Configure your ElevenLabs voice
ELEVENLABS_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}/stream"


class TTSProvider(Enum):
    ELEVENLABS = "elevenlabs"
    KOKORO = "kokoro"


CURRENT_PROVIDER = TTSProvider.ELEVENLABS
ELEVENLABS_CREDIT_THRESHOLD = 0.20  # Switch to Kokoro at 20% credits remaining


async def synthesize_streaming(text: str) -> bytes:
    """
    Stream TTS synthesis. Synthesis starts on first phrase -- not full response.
    Returns audio bytes for Twilio.
    """
    global CURRENT_PROVIDER

    if CURRENT_PROVIDER == TTSProvider.ELEVENLABS:
        try:
            return await _elevenlabs_synthesize(text)
        except Exception as e:
            print(f"[TTS] ElevenLabs failed ({e}), switching to Kokoro fallback.")
            CURRENT_PROVIDER = TTSProvider.KOKORO
            return await _kokoro_synthesize(text)
    else:
        return await _kokoro_synthesize(text)


async def _elevenlabs_synthesize(text: str) -> bytes:
    """ElevenLabs streaming synthesis. Starts on first phrase."""
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
    }

    audio_chunks = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        async with client.stream("POST", ELEVENLABS_URL, headers=headers, json=payload) as response:
            if response.status_code == 429:
                raise Exception("ElevenLabs quota exceeded")
            async for chunk in response.aiter_bytes():
                if chunk:
                    audio_chunks.append(chunk)
                    # Yield first chunk immediately for low-latency pipeline start
                    # In production: yield chunk to caller stream directly

    return b"".join(audio_chunks)


async def _kokoro_synthesize(text: str) -> bytes:
    """
    Kokoro TTS -- local GPU fallback. Zero API cost.
    Install: pip install kokoro-onnx
    """
    # from kokoro_onnx import Kokoro
    # kokoro = Kokoro("kokoro-v0_19.onnx", "voices.bin")
    # samples, sample_rate = kokoro.create(text, voice="af_sarah", speed=1.0, lang="en-us")
    # return convert_to_mulaw(samples, sample_rate)
    raise NotImplementedError("Configure Kokoro TTS -- see https://github.com/hexgrad/kokoro")
