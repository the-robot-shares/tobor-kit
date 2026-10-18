"""FastAPI host: serve both artifact tags.

pip install fastapi uvicorn
uvicorn embed:app --port 8000

Host-owned persistence. Kit does not PUT. No secrets on the element.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse

app = FastAPI()

_store: dict[str, Any] = {
    "id": "demo",
    "title": "Release notes",
    "version": 1,
    "body": "Ship the island.\nDo not render HTML.",
    "mime": "text/plain",
}

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>artifact family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-view.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-editor.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <tobor-artifact-view id="view"></tobor-artifact-view>
    <tobor-artifact-editor id="editor"></tobor-artifact-editor>
    <script type="module">
      const view = document.querySelector('#view');
      const editor = document.querySelector('#editor');
      const apply = (artifact) => { view.artifact = artifact; editor.artifact = artifact; };
      fetch('/artifacts/demo', {credentials: 'same-origin'}).then((r) => r.json()).then(apply);
      view.addEventListener('review-start', (event) => {
        fetch('/reviews', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        });
      });
      editor.addEventListener('artifact-save', (event) => {
        const id = event.detail.id || 'demo';
        fetch('/artifacts/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        }).then((r) => r.json()).then(apply);
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return PAGE


@app.get("/artifacts/{item_id}")
async def show(item_id: str) -> dict[str, Any]:
    if _store["id"] != item_id:
        raise HTTPException(status_code=404, detail="not found")
    return _store


@app.put("/artifacts/{item_id}")
async def update(item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    _store["id"] = item_id
    if payload.get("title"):
        _store["title"] = payload["title"]
    if "body" in payload:
        _store["body"] = payload["body"]
    if payload.get("mime"):
        _store["mime"] = payload["mime"]
    _store["version"] = int(_store["version"]) + 1
    return _store


@app.post("/reviews")
async def review(payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "review": payload}
