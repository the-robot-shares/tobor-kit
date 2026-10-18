"""FastAPI host: serve a page that mounts <noizu-billing-status>.

Host-owned snapshot in page JS. POST /billing/portal stubs a portal URL.
Production hosts create a Stripe Billing Portal session server-side.
Never put sk_… on the element. Run: `uvicorn embed:app --port 8080`
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-billing-status</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/billing-status/noizu-billing-status.js"></script>
  </head>
  <body>
    <h1>Billing</h1>
    <noizu-billing-status></noizu-billing-status>
    <script type="module">
      const el = document.querySelector('noizu-billing-status');
      // Host-owned snapshot. Never a Stripe secret on the element.
      el.subscription = {status: 'active', planName: 'Pro', renewsAt: '2026-10-01'};
      el.addEventListener('portal-open', () => {
        fetch('/billing/portal', {method: 'POST', credentials: 'same-origin'})
          .then((res) => res.json())
          .then((body) => { if (body.url) location.assign(body.url); });
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return PAGE


@app.post("/billing/portal")
async def portal() -> JSONResponse:
    # Host-owned: Stripe Billing Portal session. Stub URL only — no secrets here.
    return JSONResponse({"url": "https://billing.example.test/session"})
