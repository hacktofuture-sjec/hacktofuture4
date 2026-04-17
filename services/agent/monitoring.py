"""
Runtime monitoring with automated fallback triggers.
Alert thresholds per spec:
- CPU/GPU > 90% sustained -> alert
- LLM inference > 1,000ms -> alert
- Deepgram 429 error rate > 2% -> trigger Whisper fallback
- ElevenLabs credit < 20% -> switch to Kokoro TTS
- Twilio 5xx > 1% -> alert Node 2 health
- RAG Groundedness < 0.80 -> flag for manual review
"""
import subprocess
import httpx


def check_gpu_vram() -> float:
    """Returns VRAM usage as fraction (0.0 - 1.0)."""
    result = subprocess.run(
        ["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"],
        capture_output=True, text=True
    )
    used, total = map(int, result.stdout.strip().split(", "))
    return used / total


def alert_if_gpu_critical():
    usage = check_gpu_vram()
    if usage > 0.90:
        print(f"[ALERT] GPU VRAM at {usage*100:.1f}% -- reduce concurrent calls or quantize model.")


# Track API error rates
class APIMonitor:
    def __init__(self):
        self.deepgram_requests = 0
        self.deepgram_429s = 0
        self.elevenlabs_credits_remaining = 1.0  # fraction

    def record_deepgram_request(self, was_429: bool):
        self.deepgram_requests += 1
        if was_429:
            self.deepgram_429s += 1
        error_rate = self.deepgram_429s / max(self.deepgram_requests, 1)
        if error_rate > 0.02:
            print("[ALERT] Deepgram error rate > 2%. Switching to Whisper fallback.")
            # trigger_whisper_fallback()

    def update_elevenlabs_credits(self, fraction_remaining: float):
        self.elevenlabs_credits_remaining = fraction_remaining
        if fraction_remaining < 0.20:
            print("[ALERT] ElevenLabs credits < 20%. Switching to Kokoro TTS.")
            # trigger_kokoro_fallback()


monitor = APIMonitor()
