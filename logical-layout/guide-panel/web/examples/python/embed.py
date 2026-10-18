"""Serve the guide-panel mount page.

GET /api/tobor-kit/guide is the config projection on the Elixir or Go Guide
API (no NPL preamble). This host only serves the tag; reverse-proxy the
prefix or set base-url at that origin. Do not reimplement the service.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <body>
    <div class="demo-frame">
      <tobor-guide-panel id="guide" base-url="/api/tobor-kit" placement="floating"></tobor-guide-panel>
    </div>
    <script type="module">
      import "/assets/tobor-kit/guide-panel.js";
      const el = document.getElementById("guide");
      el.token = window.__TOBOR_ACCESS_TOKEN;
      el.addEventListener("tobor-turn-submitted", (event) => {
        console.debug("turn", event.detail);
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def embed() -> str:
    return PAGE


# Reverse-proxy /api/tobor-kit to elixir/ or go/
# (TOBOR_KIT_UPSTREAM, default http://127.0.0.1:8080), including GET /guide
# and SSE POST /sessions/{id}/turn. Example Caddy:
#   reverse_proxy /api/tobor-kit localhost:8080
