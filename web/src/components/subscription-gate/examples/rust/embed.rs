//! Host snippet: serve `<noizu-subscription-gate>` and optional GET /entitlement.
//!
//! Cargo: `axum`, `tokio = { version = "1", features = ["full"] }`, `serde_json`.
//! Replace the stub with a session/billing lookup. Host owns entitlement truth.

use axum::response::Html;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(page))
        .route("/entitlement", get(entitlement));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

async fn entitlement() -> Json<Value> {
    Json(json!({"entitled": true}))
}

async fn page() -> Html<&'static str> {
    Html(
        r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-subscription-gate</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/subscription-gate/noizu-subscription-gate.js"></script>
  </head>
  <body>
    <h1>Subscription gate</h1>
    <noizu-subscription-gate check-url="/entitlement" redirect-to="/pricing">
      <p>Subscriber content (check-url)</p>
    </noizu-subscription-gate>
    <noizu-subscription-gate redirect-to="/pricing">
      <p>Blocked unless the host sets entitled</p>
    </noizu-subscription-gate>
    <script type="module">
      document.querySelectorAll('noizu-subscription-gate').forEach((el) => {
        el.addEventListener('gate-blocked', (event) => {
          console.info('gate-blocked', event.detail.redirectTo);
        });
      });
    </script>
  </body>
</html>"#,
    )
}
