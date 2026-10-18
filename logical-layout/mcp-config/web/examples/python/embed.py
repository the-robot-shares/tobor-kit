"""Echo host for <tobor-mcp-config>.

pip install fastapi uvicorn
uvicorn embed:app --port 8000

Host validates. Never put secrets on the element.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-mcp-config</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-config/tobor-mcp-config.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-config></tobor-mcp-config></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-config');
      const cfg = await fetch('/mcp/config', {credentials: 'same-origin'}).then((r) => r.json());
      el.url = cfg.url || '';
      el.transport = cfg.transport || 'http';
      if (cfg.extras) el.extras = cfg.extras;
      el.addEventListener('config-change', (event) => {
        fetch('/mcp/config', {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        });
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def page() -> HTMLResponse:
    return HTMLResponse(PAGE)


@app.get("/mcp/config")
def show() -> JSONResponse:
    return JSONResponse({"url": "https://mcp.example.test/mcp", "transport": "http"})


@app.put("/mcp/config")
async def update(request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json()
    return JSONResponse({"ok": True, "config": body})
