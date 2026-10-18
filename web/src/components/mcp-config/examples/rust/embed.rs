//! Echo host for `<tobor-mcp-config>`.
//! Host validates. Never put secrets on the element.
//!
//! [dependencies]
//! axum = "0.8"
//! serde_json = "1"
//! tokio = { version = "1", features = ["macros", "rt-multi-thread"] }

use axum::{response::Html, routing::get, Json, Router};
use serde_json::{json, Value};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-mcp-config</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-config/tobor-mcp-config.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-config></tobor-mcp-config></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-config');
      const cfg = await fetch('/mcp/config', {credentials: 'same-origin'}).then((r) => r.json());
      el.url = cfg.url || '';
      el.transport = cfg.transport || 'http';
      if (cfg.extras) el.extras = cfg.extras;
      el.addEventListener('config-change', (event) => {
        fetch('/mcp/config', {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        });
      });
    </script>
  </body>
</html>"#;

async fn index() -> Html<&'static str> {
    Html(PAGE)
}

async fn show() -> Json<Value> {
    Json(json!({"url": "https://mcp.example.test/mcp", "transport": "http"}))
}

async fn update(Json(body): Json<Value>) -> Json<Value> {
    Json(json!({ "ok": true, "config": body }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/mcp/config", get(show).put(update));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
