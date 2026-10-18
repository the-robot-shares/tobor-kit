"""Host snippet: serve <noizu-subscription-gate> and optional GET /entitlement.

pip install fastapi uvicorn
uvicorn embed:app --port 8000

Replace the stub with a session/billing lookup. Host owns entitlement truth.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-subscription-gate</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/subscription-gate/noizu-subscription-gate.js"></script>
  </head>
  <body>
    <h1>Subscription gate</h1>
    <noizu-subscription-gate check-url="/entitlement" redirect-to="/pricing">
      <p>Subscriber content (check-url)</p>
    </noizu-subscription-gate>
    <noizu-subscription-gate redirect-to="/pricing">
      <p>Blocked unless the host sets entitled</p>
    </noizu-subscription-gate>
    <script type="module">
      document.querySelectorAll('noizu-subscription-gate').forEach((el) => {
        el.addEventListener('gate-blocked', (event) => {
          console.info('gate-blocked', event.detail.redirectTo);
        });
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def page() -> str:
    return PAGE


@app.get("/entitlement")
def entitlement() -> dict[str, bool]:
    # Host-owned: look up the session / billing record. This stub always entitles.
    return {"entitled": True}
