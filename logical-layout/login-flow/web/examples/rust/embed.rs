//! axum host for `<tobor-login-flow>`.
//!
//! Serves the island and owns `/auth/oidc/callback` + `/auth/session`.
//! Public config only. Never a client secret. Production hosts should
//! POST `{issuer}/token` (`grant_type=authorization_code`, PKCE verifier)
//! and verify the id token (JWKS) the way `ToborKit.Auth.OIDC` does.

use axum::{
    extract::Json,
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse, Redirect},
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::env;

const REDIRECT_PATH: &str = "/auth/oidc/callback";

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(page))
        .route(REDIRECT_PATH, get(callback))
        .route("/auth/session", post(session_mint));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

fn public_auth() -> Value {
    json!({
        "required": true,
        "provider": "authentik",
        "issuer": env::var("TOBOR_KIT_OIDC_ISSUER").ok(),
        "client_id": env::var("TOBOR_KIT_OIDC_CLIENT_ID").ok(),
        "scopes": ["openid", "email", "profile"],
        "redirect_path": REDIRECT_PATH,
    })
}

async fn page() -> Html<String> {
    let auth = public_auth();
    Html(format!(
        r#"<!doctype html>
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
</body></html>"#,
        auth = auth
    ))
}

async fn callback() -> impl IntoResponse {
    // Host owns token exchange + cookie. 302 to / without ?code=.
    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        "tobor_session=host-session; Path=/; HttpOnly; Secure; SameSite=Lax"
            .parse()
            .unwrap(),
    );
    (headers, Redirect::to("/"))
}

async fn session_mint(Json(_body): Json<Value>) -> StatusCode {
    // Verify id_token (JWKS) then Set-Cookie. Never accept a client secret.
    StatusCode::NO_CONTENT
}
