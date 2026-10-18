"""Host snippet: serve a page that mounts <noizu-faq> with slotted details.

No FAQ API. Run: `uvicorn embed:app --port 8080`
Host-owned: persist faq-toggle in page JS if you want analytics.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-faq</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/faq/noizu-faq.js"></script>
  </head>
  <body>
    <h1>FAQ</h1>
    <noizu-faq mode="many">
      <details>
        <summary>What is this?</summary>
        <p>A Light DOM island that decorates slotted native details/summary.</p>
      </details>
      <details>
        <summary>Does the host need a backend?</summary>
        <p>No. The island is host-only markup.</p>
      </details>
      <details>
        <summary>Can only one item stay open?</summary>
        <p>Set <code>mode="one"</code> for accordion behavior.</p>
      </details>
    </noizu-faq>
  </body>
</html>
"""

app = FastAPI()


@app.get("/", response_class=HTMLResponse)
def faq_page() -> str:
    return PAGE
