"""
Handles Twilio Media Streams WebSocket.
Validates X-Twilio-Signature on every request.
Forwards audio stream to LiveKit Agent on Node 1.
"""
import hmac
import hashlib
import base64
import os
from fastapi import FastAPI, Request, WebSocket, HTTPException
from twilio.twiml.voice_response import VoiceResponse, Connect, Stream

app = FastAPI()
TWILIO_AUTH_TOKEN = os.environ["TWILIO_AUTH_TOKEN"]


def validate_twilio_signature(request: Request, body: bytes) -> bool:
    """Validates X-Twilio-Signature to ensure request is from Twilio."""
    signature = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    mac = hmac.new(
        TWILIO_AUTH_TOKEN.encode(),
        (url + body.decode()).encode(),
        hashlib.sha1
    )
    return hmac.compare_digest(
        base64.b64encode(mac.digest()).decode(),
        signature
    )


@app.post("/twilio/incoming")
async def incoming_call(request: Request):
    """Returns TwiML to initiate Media Streams WebSocket."""
    body = await request.body()
    if not validate_twilio_signature(request, body):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")

    response = VoiceResponse()
    connect = Connect()
    # WSS endpoint on this same server -- Cloudflare tunnel exposes it
    stream = Stream(url=f"wss://{request.headers['host']}/twilio/stream")
    connect.append(stream)
    response.append(connect)
    return str(response)


@app.websocket("/twilio/stream")
async def twilio_stream(websocket: WebSocket):
    """
    Receives raw 16kHz PCM audio from Twilio.
    Forwards to LiveKit Agent on Node 1.
    Audio format: audio/l16; rate=16000; channels=1
    """
    await websocket.accept()
    # TODO Phase 3: Forward to LiveKit Agent
    async for message in websocket.iter_text():
        print(f"[Twilio] Received media frame: {len(message)} bytes")
        # Forward to LiveKit Agent WebSocket here
