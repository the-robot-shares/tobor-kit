"""Serve the tobor-telemetry-toggle page.

Do not reimplement GET/PUT /telemetry/consent. Reverse-proxy /api/tobor-kit
to the Elixir or Go Guide API. 403 = not overridable; the element renders
nothing. Host-owned: secrets, IdP.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

PAGE = """<!doctype html>
<meta charset="utf-8">
<title>tobor-telemetry-toggle</title>
<tobor-telemetry-toggle></tobor-telemetry-toggle>
<script type="module">
  import {ToborKitClient} from "https://cdn.derobot.is/tobor-kit/latest/client.js";
  import "https://cdn.derobot.is/tobor-kit/latest/components/telemetry-toggle/telemetry-toggle.js";
  const el = document.querySelector("tobor-telemetry-toggle");
  el.client = new ToborKitClient({
    baseUrl: "/api/tobor-kit",
    token: () => sessionStorage.getItem("tobor-access-token")
  });
  el.addEventListener("tobor-telemetry-change", (e) => {
    console.log("tobor-telemetry-change", e.detail.consent);
  });
</script>
"""

app = FastAPI()


@app.get("/", response_class=HTMLResponse)
def telemetry_toggle_page() -> str:
    return PAGE


# Reverse-proxy /api/tobor-kit to the Elixir/Go Guide API
# (TOBOR_KIT_ORIGIN, default http://127.0.0.1:8080).
# Example Caddy: reverse_proxy /api/tobor-kit localhost:8080
