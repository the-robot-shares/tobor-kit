//! axum host: serve `<tobor-asset-view>` and `<tobor-asset-editor>`.
//!
//! GET `/assets/:id` stubs a snapshot. PUT `/assets/:id` echoes `asset-save`.
//! Production hosts own blob storage. Never put secrets on the element.
//! Cargo: `axum`, `serde_json`, `tokio = { version = "1", features = ["full"] }`.
//! axum 0.8: change `/assets/:id` to `/assets/{id}`.

use axum::{
    extract::Path,
    response::Html,
    routing::get,
    Json, Router,
};
use serde_json::{json, Value};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>asset family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/asset/asset-view.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/asset/asset-editor.js"></script>
  </head>
  <body>
    <h1>Asset</h1>
    <tobor-asset-view></tobor-asset-view>
    <tobor-asset-editor></tobor-asset-editor>
    <script type="module">
      const view = document.querySelector('tobor-asset-view');
      const editor = document.querySelector('tobor-asset-editor');
      fetch('/assets/note-1')
        .then((res) => res.json())
        .then((asset) => {
          view.asset = asset;
          editor.asset = asset;
        });
      editor.addEventListener('asset-save', (event) => {
        fetch('/assets/' + event.detail.id, {
          method: 'PUT',
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

async fn show(Path(id): Path<String>) -> Json<Value> {
    Json(json!({
        "id": id,
        "name": "readme.txt",
        "mime": "text/plain",
        "body": "Hello from the host."
    }))
}

async fn save(Path(_id): Path<String>, Json(body): Json<Value>) -> Json<Value> {
    // Host-owned persist. Stub echo only — no secrets here.
    Json(json!({ "ok": true, "asset": body }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/assets/:id", get(show).put(save));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
