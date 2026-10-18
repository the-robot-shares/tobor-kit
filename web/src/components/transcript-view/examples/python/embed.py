"""Serve the transcript-view mount page.

Transcript is GET/DELETE /api/tobor-kit/sessions/{sessionId}/transcript on
the Elixir or Go Guide API. This host only serves the tag; it does not
reimplement the store. 501 = client store (memory/local), not empty.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <body>
    <div class="demo-frame">
      <tobor-transcript-view></tobor-transcript-view>
    </div>
    <script type="module">
      import {ToborKitClient} from "/assets/tobor-kit/client.js";
      import {createBackendStore, createMemoryStore} from "/assets/tobor-kit/transcript-store.js";
      import "/assets/tobor-kit/transcript-view.js";
      const el = document.querySelector("tobor-transcript-view");
      const sessionId = new URLSearchParams(location.search).get("session");
      el.addEventListener("tobor-transcript-clear", () => {
        el.turns = [];
        el.load = null;
      });
      if (sessionId) {
        const store = createBackendStore(new ToborKitClient({
          baseUrl: "/api/tobor-kit",
          token: () => window.__TOBOR_ACCESS_TOKEN
        }), sessionId);
        const load = await store.load();
        el.store = store;
        el.load = load;
        if (load.status === "ok") el.turns = load.turns;
      } else {
        const store = createMemoryStore();
        el.store = store;
        el.turns = (await store.load()).turns;
      }
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def embed() -> str:
    return PAGE


# Mount this app on the same origin as ToborKit.Endpoint / the Go server,
# or reverse-proxy /api/tobor-kit to that process. Hosts own the bearer token.
