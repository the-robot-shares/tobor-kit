"""Serve the tobor-task-menu page and stub GET /api/tobor-kit/mcp/tools.

Production dressing lives in elixir/ and go/. This returns canned JSON only.
Host-owned: secrets, IdP, bearer check when auth.required.
"""

from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse, JSONResponse

INVENTORY = {
    "groups": [{"id": "Github", "label": "Github"}],
    "tools": [
        {"name": "Github.BranchCreate", "label": "New branch", "group": "Github"},
        {
            "name": "Github.PullCreate",
            "label": "Open a PR",
            "group": "Github",
            "confirm": True,
        },
    ],
    "degraded": [
        {"server": "tickets", "label": "Tickets", "error": "timeout"},
    ],
}

PAGE = """<!doctype html>
<meta charset="utf-8">
<title>tobor-task-menu</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/task-menu/task-menu.js"></script>
<div class="demo-frame"><tobor-task-menu></tobor-task-menu></div>
<script type="module">
  const el = document.querySelector('tobor-task-menu');
  const token = sessionStorage.getItem('tobor-access-token');
  const headers = token ? {Authorization: 'Bearer ' + token} : {};
  const res = await fetch('/api/tobor-kit/mcp/tools', {headers});
  if (res.ok) el.inventory = await res.json();
  el.addEventListener('tobor-task-select', (e) => {
    console.log('tobor-task-select', e.detail.tool);
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
def task_menu_page() -> str:
    return PAGE
