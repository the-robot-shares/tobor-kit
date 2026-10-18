//! Echo host for `<tobor-mcp-domain>`.
//! Host-owned persistence and session cookies stay off the element.
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
    <title>tobor-mcp-domain</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-domain/tobor-mcp-domain.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-domain></tobor-mcp-domain></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-domain');
      const tools = await fetch('/mcp/domain', {credentials: 'same-origin'}).then((r) => r.json());
      el.tools = tools.tools;
      el.addEventListener('tool-visibility-change', (event) => {
        fetch('/mcp/domain', {
          method: 'PATCH',
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
    Json(json!({"tools": [
        {"name": "Github.PullCreate", "visibility": "visible"},
        {"name": "Github.IssueList", "visibility": "discoverable"},
        {"name": "Filesystem.Write", "visibility": "disabled"}
    ]}))
}

async fn update(Json(body): Json<Value>) -> Json<Value> {
    Json(json!({ "ok": true, "tool": body }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/mcp/domain", get(show).patch(update));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
