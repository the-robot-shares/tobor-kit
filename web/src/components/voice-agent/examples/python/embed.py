"""FastAPI host for <tobor-voice-agent>.

Production voice is backend/ (Node). This file stubs POST /voice/sessions and
the ready/transcript frames so the island can mount without provider keys.

    pip install fastapi uvicorn httpx
    uvicorn embed:app --port 8091
"""

from __future__ import annotations

import os
import uuid

import httpx
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse

GATEWAY = os.environ.get("VOICE_GATEWAY_URL", "http://127.0.0.1:8081")
app = FastAPI()

PAGE = """<!doctype html><meta charset="utf-8"><title>tobor-voice-agent</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/voice-agent/voice-agent.js"></script>
<tobor-voice-agent organization="acme" project="app" backend="litellm" engine="tts" model="gpt-4o-mini" label="Voice agent"></tobor-voice-agent>
<script type="module">
  const agent = document.querySelector('tobor-voice-agent');
  agent.backendUrl = location.origin;
  agent.tools = []; agent.mcpTools = [];
</script>"""


@app.get("/")
def index() -> HTMLResponse:
    return HTMLResponse(PAGE)


@app.post("/voice/sessions")
async def create_session(request: Request):
    # Host-owned auth belongs here. Do not return provider API keys.
    body = await request.json()
    try:
        async with httpx.AsyncClient() as client:
            upstream = await client.post(f"{GATEWAY}/voice/sessions", json=body, timeout=15.0)
        return JSONResponse(upstream.json(), status_code=upstream.status_code)
    except httpx.HTTPError:
        session_id = str(uuid.uuid4())
        return JSONResponse(
            {
                "sessionId": session_id,
                "websocketUrl": f"ws://{request.url.hostname}:{request.url.port or 8091}/voice/sessions/{session_id}/socket",
            },
            status_code=201,
        )


@app.websocket("/voice/sessions/{session_id}/socket")
async def voice_socket(ws: WebSocket, session_id: str) -> None:
    await ws.accept()
    await ws.send_json({"type": "ready", "sessionId": session_id})
    try:
        while True:
            message = await ws.receive_json()
            kind = message.get("type")
            if kind == "interrupt":
                await ws.send_json({"type": "interrupted", "turnId": message.get("turnId")})
                continue
            if kind not in {"input.text", "input.image", "input.screenshot", "input.audio"}:
                continue
            turn_id = str(uuid.uuid4())
            text = message.get("text") or ("[audio]" if kind == "input.audio" else "[image]")
            await ws.send_json({"type": "animation", "state": "thinking", "turnId": turn_id})
            await ws.send_json({"type": "transcript", "role": "user", "text": text, "final": True, "turnId": turn_id})
            reply = f"stub: {text}"
            await ws.send_json({"type": "transcript", "role": "assistant", "text": reply, "final": True, "turnId": turn_id})
            await ws.send_json({"type": "text", "text": reply, "final": True, "turnId": turn_id})
            await ws.send_json({"type": "animation", "state": "idle", "turnId": turn_id})
    except WebSocketDisconnect:
        return
