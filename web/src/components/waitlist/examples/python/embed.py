"""ForYou-compatible host for <noizu-waitlist>.

pip install fastapi uvicorn
uvicorn embed:app --port 8000
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
    allow_credentials=False,
)

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-waitlist</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/waitlist/noizu-waitlist.js"></script>
    <style>
      body{font-family:system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem}
      .field-group{display:grid;gap:.25rem;margin:.5rem 0}
      .field-input,.field-select,.field-textarea{padding:.4rem}
      .btn{padding:.4rem .8rem;cursor:pointer}
      .success{color:#0a0}.danger{color:#c00}
    </style>
  </head>
  <body>
    <noizu-waitlist slug="my-site" source="landing"></noizu-waitlist>
    <script type="module">
      const el = document.querySelector('noizu-waitlist');
      el.api = location.origin;
      el.addEventListener('waitlist-success', ev => console.info('waitlist-success', ev.detail));
      el.addEventListener('waitlist-error', ev => console.warn('waitlist-error', ev.detail));
    </script>
  </body>
</html>
"""


def manifest(name: str) -> dict[str, Any]:
    return {
        "list": {
            "name": name,
            "description": "Join the waitlist.",
            "opt_in_mode": "single",
            "settings": {"success_message": "You're on the list!"},
            "attributes": [
                {
                    "slug": "email",
                    "name": "Email",
                    "type": "email",
                    "required": True,
                    "is_identity": True,
                    "sort_order": 0,
                }
            ],
        }
    }


async def accept_signup(request: Request, list_id: str) -> JSONResponse:
    body = await request.json()
    honeypot = str(body.get("company_website") or "").strip()
    if honeypot == "":
        print(
            "waitlist signup",
            {"list": list_id, "source": body.get("source", "widget"), "values": body.get("values", {})},
            flush=True,
        )
    return JSONResponse({"accepted": True}, status_code=202)


@app.get("/", response_class=HTMLResponse)
def page() -> str:
    return PAGE


@app.get("/api/v1/public/lists/{slug}")
def get_list(slug: str) -> dict[str, Any]:
    return manifest(slug)


@app.post("/api/v1/public/lists/{slug}/signups")
async def post_list_signup(slug: str, request: Request) -> JSONResponse:
    return await accept_signup(request, slug)


@app.get("/api/v1/public/services/{service}/lists/{list_slug}")
def get_service_list(service: str, list_slug: str) -> dict[str, Any]:
    return manifest(f"{service}/{list_slug}")


@app.post("/api/v1/public/services/{service}/lists/{list_slug}/signups")
async def post_service_signup(service: str, list_slug: str, request: Request) -> JSONResponse:
    return await accept_signup(request, f"{service}/{list_slug}")
