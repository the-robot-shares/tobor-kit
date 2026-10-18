//! axum host: serve prompt tags. Stub GET/PUT/POST /prompts/* echoes the payload.
//! Host-owned persistence and session cookies stay off the element.

use axum::{
    extract::Path,
    response::Html,
    routing::{get, post, put},
    Json, Router,
};
use serde_json::{json, Value};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>prompt family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/prompt/tobor-prompt-library.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/prompt/tobor-prompt-history.js"></script>
  </head>
  <body>
    <div class="demo-frame">
      <tobor-prompt-library></tobor-prompt-library>
      <tobor-prompt-history></tobor-prompt-history>
    </div>
    <script type="module">
      const libraryEl = document.querySelector('tobor-prompt-library');
      const historyEl = document.querySelector('tobor-prompt-history');
      const prompts = await fetch('/prompts', {credentials: 'same-origin'}).then((r) => r.json());
      libraryEl.prompts = prompts.prompts;
      const history = await fetch('/prompts/history', {credentials: 'same-origin'}).then((r) => r.json());
      historyEl.entries = history.entries;
      historyEl.diff = {
        left: {label: 'v1', body: 'You are a helpful assistant.'},
        right: {label: 'v2', body: 'You are a concise assistant.\nNo HTML.'},
      };
      libraryEl.addEventListener('prompt-select', (event) => { libraryEl.selectedId = event.detail.id; });
      const persistStar = async (event) => {
        await fetch('/prompts/' + encodeURIComponent(event.detail.id) + '/star', {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        });
      };
      libraryEl.addEventListener('prompt-star', persistStar);
      historyEl.addEventListener('prompt-star', persistStar);
      historyEl.addEventListener('prompt-fork', async (event) => {
        await fetch('/prompts/' + encodeURIComponent(event.detail.id) + '/fork', {
          method: 'POST',
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

async fn prompts() -> Json<Value> {
    Json(json!({"prompts": [{"id": "sys", "title": "System", "body": "You are a helpful assistant.\nDo not render HTML.", "starred": true}]}))
}

async fn history() -> Json<Value> {
    Json(json!({"entries": [{"id": "sys-v1", "title": "System", "at": "2026-01-01T12:00:00Z", "version": 1}]}))
}

async fn star(Path(id): Path<String>, Json(body): Json<Value>) -> Json<Value> {
    Json(json!({ "ok": true, "id": body.get("id").cloned().unwrap_or(json!(id)), "starred": body.get("starred") }))
}

async fn fork(Path(id): Path<String>) -> Json<Value> {
    Json(json!({ "ok": true, "id": format!("{id}-fork"), "forkedFrom": id }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/prompts", get(prompts))
        .route("/prompts/history", get(history))
        .route("/prompts/{id}/star", put(star))
        .route("/prompts/{id}/fork", post(fork));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
