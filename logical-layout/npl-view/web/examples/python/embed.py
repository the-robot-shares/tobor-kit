"""FastAPI host: serve <tobor-npl-view>.

pip install fastapi uvicorn
uvicorn embed:app --port 8000

No kit API. Host-owned: set source. Never put secrets on the element.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-npl-view</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/npl-view/npl-view.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <h1>NPL view</h1>
    <div class="demo-frame">
      <tobor-npl-view id="npl"></tobor-npl-view>
    </div>
    <pre id="log"></pre>
    <script type="module">
      const el = document.querySelector('#npl');
      const log = document.querySelector('#log');
      el.source = `⌜NPL@1.0⌝

# Syntax
Greet {user.name} with [...:1sentence| warm].
Use 🎯 care.

# Agent
⌜guide|agent|NPL@1.0⌝
You are a helpful guide.
⌞guide⌟
`;
      el.addEventListener('npl-copy', (event) => {
        log.textContent = JSON.stringify({copy: event.detail});
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return PAGE
