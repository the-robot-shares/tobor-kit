"""Echo host for <tobor-mcp-clients>.

pip install fastapi uvicorn
uvicorn embed:app --port 8000

OAuth redirect is host-owned. This stub does not redirect and never returns secrets.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-mcp-clients</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-clients/tobor-mcp-clients.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-clients></tobor-mcp-clients></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-clients');
      const load = () => fetch('/mcp/clients', {credentials: 'same-origin'}).then((r) => r.json()).then((body) => { el.clients = body.clients; });
      await load();
      el.addEventListener('client-authorize', async (event) => {
        const body = await fetch('/mcp/clients/' + encodeURIComponent(event.detail.id) + '/authorize', {
          method: 'POST', credentials: 'same-origin',
        }).then((r) => r.json());
        // Host-owned: if (body.redirect) location.assign(body.redirect);
        await load();
      });
      el.addEventListener('client-revoke', async (event) => {
        await fetch('/mcp/clients/' + encodeURIComponent(event.detail.id) + '/revoke', {
          method: 'POST', credentials: 'same-origin',
        });
        await load();
      });
    </script>
  </body>
</html>
"""

CLIENTS = [
    {"id": "github", "name": "GitHub", "status": "disconnected", "auth": "oauth"},
    {"id": "search", "name": "Search", "status": "connected", "auth": "api-key"},
]


@app.get("/", response_class=HTMLResponse)
def page() -> HTMLResponse:
    return HTMLResponse(PAGE)


@app.get("/mcp/clients")
def index() -> JSONResponse:
    return JSONResponse({"clients": CLIENTS})


@app.post("/mcp/clients/{client_id}/authorize")
def authorize(client_id: str) -> JSONResponse:
    # Production oauth: return {"ok": True, "redirect": authorize_url} — HOST navigates.
    return JSONResponse({"ok": True, "id": client_id, "status": "connected"})


@app.post("/mcp/clients/{client_id}/revoke")
def revoke(client_id: str) -> JSONResponse:
    return JSONResponse({"ok": True, "id": client_id, "status": "disconnected"})
