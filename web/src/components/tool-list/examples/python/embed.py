"""Throwaway FastAPI stub of GET /api/tobor-kit/mcp/tools.

Production dressing lives in elixir/ and go/. This returns canned JSON only.
Host-owned: TLS, bearer check when guide.auth.required. Never embed secrets.
"""

from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse, JSONResponse

INVENTORY = {
    "groups": [
        {"id": "Github", "label": "Github"},
        {"id": "Tickets", "label": "Tickets"},
    ],
    "tools": [
        {
            "name": "Github.BranchCreate",
            "label": "New branch",
            "group": "Github",
            "read_only": True,
        },
        {
            "name": "Github.PullCreate",
            "label": "Open a PR",
            "group": "Github",
            "confirm": True,
        },
        {"name": "Ticket.Create", "label": "File a ticket", "group": "Tickets"},
    ],
    "degraded": [
        {"server": "seo", "label": "SEO", "error": "connection refused"},
    ],
}

PAGE = """<!doctype html>
<meta charset="utf-8">
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/tool-list/tool-list.js"></script>
<div class="demo-frame"><tobor-tool-list></tobor-tool-list></div>
<script type="module">
  const el = document.querySelector('tobor-tool-list');
  const res = await fetch('/api/tobor-kit/mcp/tools');
  el.inventory = await res.json();
  el.addEventListener('tobor-tool-select', (e) => {
    console.info('tobor-tool-select', e.detail.tool);
  });
</script>
"""

app = FastAPI()


@app.get("/api/tobor-kit/mcp/tools")
def mcp_tools(refresh: bool = Query(False)) -> JSONResponse:
    # `refresh` is ignored in this stub; production bypasses the MCP cache.
    _ = refresh
    return JSONResponse(INVENTORY)


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return PAGE
