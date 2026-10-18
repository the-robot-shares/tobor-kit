"""Host for <noizu-human-verify>.

pip install fastapi uvicorn
uvicorn embed:app --port 8000

POST /verify → Cloudflare / Google siteverify. Secrets from env only.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse

TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
RECAPTCHA = "https://www.google.com/recaptcha/api/siteverify"

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-human-verify</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/human-verify/noizu-human-verify.js"></script>
  </head>
  <body>
    <noizu-human-verify provider="none" action="signup"></noizu-human-verify>
    <script type="module">
      const el = document.querySelector('noizu-human-verify');
      el.addEventListener('verified', (event) => {
        fetch('/verify', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(event.detail),
        }).then((r) => r.json()).then((b) => console.info('verify', b));
      });
    </script>
  </body>
</html>
"""

app = FastAPI()


@app.get("/", response_class=HTMLResponse)
def page() -> str:
    return PAGE


def siteverify(endpoint: str, secret: str, token: str, hint: str) -> JSONResponse:
    if not secret.strip():
        return JSONResponse({"ok": False, "error": hint}, status_code=501)
    if not token.strip():
        return JSONResponse({"ok": False, "error": "token required"}, status_code=400)
    data = urllib.parse.urlencode({"secret": secret, "response": token}).encode()
    req = urllib.request.Request(endpoint, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload: dict[str, Any] = json.loads(resp.read().decode())
    except Exception:
        return JSONResponse({"ok": False, "error": "siteverify unreachable"}, status_code=502)
    if payload.get("success") is True:
        return JSONResponse({"ok": True})
    return JSONResponse(
        {"ok": False, "error": "verification failed", "error-codes": payload.get("error-codes", [])},
        status_code=403,
    )


@app.post("/verify")
async def verify(request: Request) -> JSONResponse:
    body = await request.json()
    provider = str(body.get("provider") or "")
    token = str(body.get("token") or "")
    if provider == "none":
        return JSONResponse({"ok": True, "skipped": True})
    if provider == "turnstile":
        return siteverify(TURNSTILE, os.environ.get("TURNSTILE_SECRET") or "", token, "set TURNSTILE_SECRET")
    if provider == "recaptcha-v3":
        return siteverify(RECAPTCHA, os.environ.get("RECAPTCHA_SECRET") or "", token, "set RECAPTCHA_SECRET")
    return JSONResponse({"ok": False, "error": "token required"}, status_code=400)
