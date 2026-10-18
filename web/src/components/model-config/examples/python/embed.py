"""Echo host for <noizu-model-config>.

pip install fastapi uvicorn
uvicorn embed:app --port 8000

Empty api_key on PATCH keeps the stored key. Never log keys.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI()

_store: dict[str, Any] = {
    "model": "openai:gpt-4o",
    "monthly_budget_cents": 1000,
    "used_cents": 0,
    "custom": None,
    "key": "",
}

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-model-config</title>
    <script type="importmap">
      {"imports":{"lit":"https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js","lit/decorators.js":"https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"}}
    </script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <noizu-model-config id="model" catalog-url="/api/v1/ai/models" inherit allow-custom allow-budget></noizu-model-config>
    <script type="module">
      import 'https://cdn.derobot.is/tobor-kit/latest/components/model-config/noizu-model-config.js';
      const el = document.querySelector('#model');
      const patch = (ai) => fetch('/api/v1/ai/settings', {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        credentials: 'same-origin', body: JSON.stringify({ai})
      });
      fetch('/api/v1/ai/settings', {credentials:'same-origin'}).then(r => r.json()).then(({ai}) => {
        el.value = ai.model || '';
        el.budget = ai.monthly_budget_cents;
        if (ai.custom_endpoint) el.customEndpoint = {
          baseUrl: ai.custom_endpoint.base_url, model: ai.custom_endpoint.model, apiKey: ai.custom_endpoint.api_key
        };
      });
      el.addEventListener('model-change', e => patch({model: e.detail.value}));
      el.addEventListener('budget-change', e => patch({monthly_budget_cents: e.detail.amount}));
      el.addEventListener('custom-endpoint-save', e => {
        const {baseUrl, model, apiKey} = e.detail;
        patch({custom_endpoint: {base_url: baseUrl, model, api_key: apiKey}});
      });
    </script>
  </body>
</html>
"""


def mask(key: str) -> str:
    if not key:
        return ""
    return "••••" + key[-4:]


def public_ai() -> dict[str, Any]:
    custom = None
    if _store["custom"] is not None:
        custom = {**_store["custom"], "api_key": mask(str(_store["key"]))}
    return {
        "model": _store["model"],
        "monthly_budget_cents": _store["monthly_budget_cents"],
        "used_cents": _store["used_cents"],
        "custom_endpoint": custom,
    }


@app.get("/", response_class=HTMLResponse)
def page() -> HTMLResponse:
    return HTMLResponse(PAGE)


@app.get("/api/v1/ai/models")
def models() -> JSONResponse:
    return JSONResponse(
        {
            "models": [
                {"provider": "openai", "model": "gpt-4o", "label": "GPT-4o", "spec": "openai:gpt-4o"},
                {
                    "provider": "anthropic",
                    "model": "claude-3-5",
                    "label": "Claude 3.5",
                    "spec": "anthropic:claude-3-5",
                },
            ]
        }
    )


@app.get("/api/v1/ai/settings")
def show() -> JSONResponse:
    return JSONResponse({"ai": public_ai()})


@app.patch("/api/v1/ai/settings")
async def update(request: Request) -> JSONResponse:
    payload = await request.json()
    ai = payload.get("ai") or {}
    if "model" in ai:
        _store["model"] = ai["model"]
    if "monthly_budget_cents" in ai:
        _store["monthly_budget_cents"] = ai["monthly_budget_cents"]
    custom = ai.get("custom_endpoint")
    if isinstance(custom, dict):
        incoming = str(custom.get("api_key") or "")
        if incoming:
            _store["key"] = incoming
        _store["custom"] = {"base_url": custom.get("base_url", ""), "model": custom.get("model", "")}
    return JSONResponse({"ai": public_ai()})
