"""Serve a page that mounts <tobor-mode-toggle> and logs tobor-mode-change.

No backend is required. Host-owned: persist {mode, previous} if you want.
Never put secrets on this island.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tobor-mode-toggle</title>
    <script type="importmap">
      {
        "imports": {
          "lit": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js",
          "lit/decorators.js": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"
        }
      }
    </script>
  </head>
  <body>
    <tobor-mode-toggle id="toggle" mode="text"></tobor-mode-toggle>
    <pre id="log"></pre>
    <script type="module">
      import 'https://cdn.derobot.is/tobor-kit/latest/components/mode-toggle/mode-toggle.js';
      const el = document.querySelector('#toggle');
      el.modes = ['text', 'voice', 'transcript'];
      el.addEventListener('tobor-mode-change', (event) => {
        document.querySelector('#log').textContent = JSON.stringify(event.detail);
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def mode_toggle() -> HTMLResponse:
    return HTMLResponse(PAGE)
