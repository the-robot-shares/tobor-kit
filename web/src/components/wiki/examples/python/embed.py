"""FastAPI host: serve wiki tags. Stub GET/PUT /wiki/* echoes the payload.

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
    <title>wiki family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-space.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-entry.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-entry-editor.js"></script>
  </head>
  <body>
    <div class="demo-frame">
      <tobor-wiki-space></tobor-wiki-space>
      <tobor-wiki-entry></tobor-wiki-entry>
      <tobor-wiki-entry-editor></tobor-wiki-entry-editor>
    </div>
    <script type="module">
      const spacesEl = document.querySelector('tobor-wiki-space');
      const entryEl = document.querySelector('tobor-wiki-entry');
      const editorEl = document.querySelector('tobor-wiki-entry-editor');
      const spaces = await fetch('/wiki/spaces', {credentials: 'same-origin'}).then((r) => r.json());
      spacesEl.spaces = spaces.spaces;
      spacesEl.addEventListener('wiki-space-select', async (event) => {
        const id = event.detail.id === 'eng' ? 'eng-readme' : event.detail.id;
        entryEl.entry = await fetch('/wiki/entries/' + encodeURIComponent(id), {credentials: 'same-origin'}).then((r) => r.json());
      });
      entryEl.addEventListener('wiki-edit', () => { editorEl.entry = entryEl.entry; });
      editorEl.addEventListener('wiki-save', async (event) => {
        const saved = event.detail;
        const res = await fetch('/wiki/entries/' + encodeURIComponent(saved.id || 'new'), {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(saved),
        });
        entryEl.entry = (await res.json()).entry;
        editorEl.entry = entryEl.entry;
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return PAGE


@app.get("/wiki/spaces")
async def spaces() -> dict[str, Any]:
    return {"spaces": [{"id": "eng", "title": "Engineering", "slug": "eng"}]}


@app.get("/wiki/entries/{entry_id}")
async def show(entry_id: str) -> dict[str, str]:
    return {
        "id": entry_id,
        "title": "README",
        "body": "Ship the island.\nDo not render HTML.",
        "spaceId": "eng",
    }


@app.put("/wiki/entries/{entry_id}")
async def update(entry_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    entry = {**payload, "id": payload.get("id") or entry_id}
    return {"ok": True, "entry": entry}
