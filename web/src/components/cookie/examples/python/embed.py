"""FastAPI host: serve both cookie tags. Optional POST /consent echoes the payload.

Host-owned persistence and session cookies stay off the element.
"""

from typing import Any

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>cookie family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-consent.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-settings.js"></script>
  </head>
  <body>
    <noizu-cookie-settings>Cookie Settings</noizu-cookie-settings>
    <noizu-cookie-consent storage-key="start-app.cookie-consent.v1" mode="categories"></noizu-cookie-consent>
    <script type="module">
      window.addEventListener('start-app:cookie-consent-change', (event) => {
        if (!event.detail) return;
        fetch('/consent', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(event.detail),
        });
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return PAGE


@app.post("/consent")
async def echo_consent(payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "consent": payload}
