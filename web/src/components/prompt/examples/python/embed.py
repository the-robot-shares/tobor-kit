"""FastAPI host: serve prompt tags. Stub GET/PUT/POST /prompts/* echoes the payload.

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
    <title>prompt family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/prompt/tobor-prompt-library.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/prompt/tobor-prompt-history.js"></script>
  </head>
  <body>
    <div class="demo-frame">
      <tobor-prompt-library></tobor-prompt-library>
      <tobor-prompt-history></tobor-prompt-history>
    </div>
    <script type="module">
      const libraryEl = document.querySelector('tobor-prompt-library');
      const historyEl = document.querySelector('tobor-prompt-history');
      const prompts = await fetch('/prompts', {credentials: 'same-origin'}).then((r) => r.json());
      libraryEl.prompts = prompts.prompts;
      const history = await fetch('/prompts/history', {credentials: 'same-origin'}).then((r) => r.json());
      historyEl.entries = history.entries;
      historyEl.diff = {
        left: {label: 'v1', body: 'You are a helpful assistant.'},
        right: {label: 'v2', body: 'You are a concise assistant.\\nNo HTML.'},
      };
      libraryEl.addEventListener('prompt-select', (event) => { libraryEl.selectedId = event.detail.id; });
      const persistStar = async (event) => {
        await fetch('/prompts/' + encodeURIComponent(event.detail.id) + '/star', {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        });
      };
      libraryEl.addEventListener('prompt-star', persistStar);
      historyEl.addEventListener('prompt-star', persistStar);
      historyEl.addEventListener('prompt-fork', async (event) => {
        await fetch('/prompts/' + encodeURIComponent(event.detail.id) + '/fork', {
          method: 'POST',
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
async def index() -> str:
    return PAGE


@app.get("/prompts")
async def list_prompts() -> dict[str, Any]:
    return {
        "prompts": [
            {
                "id": "sys",
                "title": "System",
                "body": "You are a helpful assistant.\\nDo not render HTML.",
                "starred": True,
            }
        ]
    }


@app.get("/prompts/history")
async def history() -> dict[str, Any]:
    return {
        "entries": [
            {"id": "sys-v1", "title": "System", "at": "2026-01-01T12:00:00Z", "version": 1}
        ]
    }


@app.put("/prompts/{prompt_id}/star")
async def star(prompt_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"ok": True, "id": payload.get("id") or prompt_id, "starred": payload.get("starred")}


@app.post("/prompts/{prompt_id}/fork")
async def fork(prompt_id: str) -> dict[str, Any]:
    return {"ok": True, "id": f"{prompt_id}-fork", "forkedFrom": prompt_id}
