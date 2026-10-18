"""FastAPI host for <tobor-login-flow>.

Serves the island and owns `/auth/oidc/callback` + `/auth/session` cookies.
Public OIDC config only (issuer, client_id, scopes, redirect_path). Never a
client secret. Production hosts should verify the id token (JWKS) the way
`ToborKit.Auth.OIDC.callback/3` does — this stub shows the HTTP surface.
"""

from __future__ import annotations

import json
import os

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

REDIRECT_PATH = "/auth/oidc/callback"

app = FastAPI()


def public_auth() -> dict:
    return {
        "required": True,
        "provider": "authentik",
        "issuer": os.environ.get("TOBOR_KIT_OIDC_ISSUER"),
        "client_id": os.environ.get("TOBOR_KIT_OIDC_CLIENT_ID"),
        "scopes": ["openid", "email", "profile"],
        "redirect_path": REDIRECT_PATH,
    }


@app.get("/", response_class=HTMLResponse)
def page() -> str:
    auth = json.dumps(public_auth())
    return f"""<!doctype html>
<html lang="en"><body>
<tobor-login-flow id="login"></tobor-login-flow>
<script type="module">
  import 'https://cdn.derobot.is/tobor-kit/latest/components/login-flow/login-flow.js';
  const el = document.getElementById('login');
  el.auth = {auth};
  el.addEventListener('tobor-auth-token', async (e) => {{
    await fetch('/auth/session', {{
      method: 'POST', credentials: 'same-origin',
      headers: {{'content-type': 'application/json'}},
      body: JSON.stringify({{id_token: e.detail.tokens.id_token}}),
    }});
  }});
</script>
</body></html>"""


@app.get(REDIRECT_PATH)
async def callback(request: Request) -> RedirectResponse:
    # Host owns token exchange: POST {issuer}/token with grant_type=authorization_code,
    # client_id, redirect_uri, code, code_verifier (PKCE). No client_secret.
    # Then Set-Cookie and 302 to / without code in the URL.
    _ = request.query_params.get("code")
    response = RedirectResponse("/", status_code=302)
    response.set_cookie("tobor_session", value="host-session", httponly=True, secure=True, samesite="lax")
    return response


@app.post("/auth/session")
async def session_mint(request: Request) -> Response:
    # Public-PKCE path: body {id_token}. Verify JWKS, then Set-Cookie.
    _ = await request.json()
    response = Response(status_code=204)
    response.set_cookie("tobor_session", value="host-session", httponly=True, secure=True, samesite="lax")
    return response
