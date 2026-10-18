"""FastAPI host: serve <tobor-asset-view> and <tobor-asset-editor>.

GET /assets/{id} stubs a snapshot. PUT /assets/{id} echoes asset-save.
Production hosts own blob storage. Never put secrets on the element.
Run: `uvicorn embed:app --port 8080`
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>asset family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/asset/asset-view.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/asset/asset-editor.js"></script>
  </head>
  <body>
    <h1>Asset</h1>
    <tobor-asset-view></tobor-asset-view>
    <tobor-asset-editor></tobor-asset-editor>
    <script type="module">
      const view = document.querySelector('tobor-asset-view');
      const editor = document.querySelector('tobor-asset-editor');
      fetch('/assets/note-1')
        .then((res) => res.json())
        .then((asset) => {
          view.asset = asset;
          editor.asset = asset;
        });
      editor.addEventListener('asset-save', (event) => {
        fetch('/assets/' + event.detail.id, {
          method: 'PUT',
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


@app.get("/assets/{asset_id}")
async def show(asset_id: str) -> JSONResponse:
    return JSONResponse(
        {"id": asset_id, "name": "readme.txt", "mime": "text/plain", "body": "Hello from the host."}
    )


@app.put("/assets/{asset_id}")
async def update(asset_id: str, body: dict) -> JSONResponse:
    # Host-owned persist. Stub echo only — no secrets here.
    payload = dict(body)
    payload.setdefault("id", asset_id)
    return JSONResponse({"ok": True, "asset": payload})
