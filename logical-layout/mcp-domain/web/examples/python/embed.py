"""Echo host for <tobor-mcp-domain>.

pip install fastapi uvicorn
uvicorn embed:app --port 8000

Host-owned persistence and session cookies stay off the element.
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
    <title>tobor-mcp-domain</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-domain/tobor-mcp-domain.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-domain></tobor-mcp-domain></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-domain');
      const tools = await fetch('/mcp/domain', {credentials: 'same-origin'}).then((r) => r.json());
      el.tools = tools.tools;
      el.addEventListener('tool-visibility-change', (event) => {
        fetch('/mcp/domain', {
          method: 'PATCH',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        });
      });
    </script>
  </body>
</html>
"""

TOOLS = [
    {"name": "Github.PullCreate", "visibility": "visible"},
    {"name": "Github.IssueList", "visibility": "discoverable"},
    {"name": "Filesystem.Write", "visibility": "disabled"},
]


@app.get("/", response_class=HTMLResponse)
def page() -> HTMLResponse:
    return HTMLResponse(PAGE)


@app.get("/mcp/domain")
def show() -> JSONResponse:
    return JSONResponse({"tools": TOOLS})


@app.patch("/mcp/domain")
async def update(request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json()
    return JSONResponse({"ok": True, "tool": body})
