//! axum host: serve both cookie tags. Optional POST /consent echoes the payload.
//! Host-owned persistence and session cookies stay off the element.

use axum::{
    response::Html,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>cookie family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-consent.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-settings.js"></script>
  </head>
  <body>
    <noizu-cookie-settings>Cookie Settings</noizu-cookie-settings>
    <noizu-cookie-consent storage-key="start-app.cookie-consent.v1" mode="categories"></noizu-cookie-consent>
    <script type="module">
      window.addEventListener('start-app:cookie-consent-change', (event) => {
        if (!event.detail) return;
        fetch('/consent', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(event.detail),
        });
      });
    </script>
  </body>
</html>"#;

async fn index() -> Html<&'static str> {
    Html(PAGE)
}

async fn echo_consent(Json(body): Json<Value>) -> Json<Value> {
    Json(json!({ "ok": true, "consent": body }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/consent", post(echo_consent));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
