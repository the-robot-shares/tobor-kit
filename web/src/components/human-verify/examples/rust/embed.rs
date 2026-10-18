// Host for <noizu-human-verify>. POST /verify → provider siteverify.
// Secrets from env only (TURNSTILE_SECRET, RECAPTCHA_SECRET).
//
// [dependencies]
// axum = "0.8"
// reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
// serde = { version = "1", features = ["derive"] }
// serde_json = "1"
// tokio = { version = "1", features = ["macros", "rt-multi-thread"] }

use axum::http::StatusCode;
use axum::response::Html;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-human-verify</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/human-verify/noizu-human-verify.js"></script>
  </head>
  <body>
    <noizu-human-verify provider="none" action="signup"></noizu-human-verify>
    <script type="module">
      const el = document.querySelector('noizu-human-verify');
      el.addEventListener('verified', (event) => {
        fetch('/verify', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(event.detail),
        }).then((r) => r.json()).then((b) => console.info('verify', b));
      });
    </script>
  </body>
</html>"#;

#[derive(Deserialize)]
struct Verified {
    provider: Option<String>,
    token: Option<String>,
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(page))
        .route("/verify", post(verify));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

async fn page() -> Html<&'static str> {
    Html(PAGE)
}

async fn verify(Json(body): Json<Verified>) -> (StatusCode, Json<Value>) {
    let provider = body.provider.as_deref().unwrap_or("");
    let token = body.token.as_deref().unwrap_or("");
    match provider {
        "none" => (StatusCode::OK, Json(json!({"ok": true, "skipped": true}))),
        "turnstile" => {
            siteverify(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                std::env::var("TURNSTILE_SECRET").unwrap_or_default(),
                token,
                "set TURNSTILE_SECRET",
            )
            .await
        }
        "recaptcha-v3" => {
            siteverify(
                "https://www.google.com/recaptcha/api/siteverify",
                std::env::var("RECAPTCHA_SECRET").unwrap_or_default(),
                token,
                "set RECAPTCHA_SECRET",
            )
            .await
        }
        _ => (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "token required"})),
        ),
    }
}

async fn siteverify(endpoint: &str, secret: String, token: &str, hint: &str) -> (StatusCode, Json<Value>) {
    if secret.trim().is_empty() {
        return (
            StatusCode::NOT_IMPLEMENTED,
            Json(json!({"ok": false, "error": hint})),
        );
    }
    if token.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "token required"})),
        );
    }
    let client = reqwest::Client::new();
    let resp = client
        .post(endpoint)
        .form(&[("secret", secret.as_str()), ("response", token)])
        .send()
        .await;
    let Ok(resp) = resp else {
        return (
            StatusCode::BAD_GATEWAY,
            Json(json!({"ok": false, "error": "siteverify unreachable"})),
        );
    };
    let payload: Value = resp.json().await.unwrap_or(json!({}));
    if payload.get("success").and_then(|v| v.as_bool()) == Some(true) {
        (StatusCode::OK, Json(json!({"ok": true})))
    } else {
        (
            StatusCode::FORBIDDEN,
            Json(json!({
                "ok": false,
                "error": "verification failed",
                "error-codes": payload.get("error-codes").cloned().unwrap_or(json!([])),
            })),
        )
    }
}
