//! Echo host for `<tobor-mcp-clients>`.
//! OAuth redirect is host-owned. This stub does not redirect and never returns secrets.
//!
//! [dependencies]
//! axum = "0.8"
//! serde_json = "1"
//! tokio = { version = "1", features = ["macros", "rt-multi-thread"] }

use axum::{extract::Path, response::Html, routing::get, Json, Router};
use serde_json::{json, Value};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-mcp-clients</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-clients/tobor-mcp-clients.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <div class="demo-frame"><tobor-mcp-clients></tobor-mcp-clients></div>
    <script type="module">
      const el = document.querySelector('tobor-mcp-clients');
      const load = () => fetch('/mcp/clients', {credentials: 'same-origin'}).then((r) => r.json()).then((body) => { el.clients = body.clients; });
      await load();
      el.addEventListener('client-authorize', async (event) => {
        const body = await fetch('/mcp/clients/' + encodeURIComponent(event.detail.id) + '/authorize', {
          method: 'POST', credentials: 'same-origin',
        }).then((r) => r.json());
        // Host-owned: if (body.redirect) location.assign(body.redirect);
        await load();
      });
      el.addEventListener('client-revoke', async (event) => {
        await fetch('/mcp/clients/' + encodeURIComponent(event.detail.id) + '/revoke', {
          method: 'POST', credentials: 'same-origin',
        });
        await load();
      });
    </script>
  </body>
</html>"#;

async fn index() -> Html<&'static str> {
    Html(PAGE)
}

async fn clients() -> Json<Value> {
    Json(json!({"clients": [
        {"id": "github", "name": "GitHub", "status": "disconnected", "auth": "oauth"},
        {"id": "search", "name": "Search", "status": "connected", "auth": "api-key"}
    ]}))
}

async fn authorize(Path(id): Path<String>) -> Json<Value> {
    Json(json!({ "ok": true, "id": id, "status": "connected" }))
}

async fn revoke(Path(id): Path<String>) -> Json<Value> {
    Json(json!({ "ok": true, "id": id, "status": "disconnected" }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/mcp/clients", get(clients))
        .route("/mcp/clients/{id}/authorize", axum::routing::post(authorize))
        .route("/mcp/clients/{id}/revoke", axum::routing::post(revoke));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
