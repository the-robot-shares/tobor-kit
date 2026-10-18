//! axum host: serve wiki tags. Stub GET/PUT /wiki/* echoes the payload.
//! Host-owned persistence and session cookies stay off the element.

use axum::{
    extract::Path,
    response::Html,
    routing::{get, put},
    Json, Router,
};
use serde_json::{json, Value};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>wiki family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-space.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-entry.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-entry-editor.js"></script>
  </head>
  <body>
    <div class="demo-frame">
      <tobor-wiki-space></tobor-wiki-space>
      <tobor-wiki-entry></tobor-wiki-entry>
      <tobor-wiki-entry-editor></tobor-wiki-entry-editor>
    </div>
    <script type="module">
      const spacesEl = document.querySelector('tobor-wiki-space');
      const entryEl = document.querySelector('tobor-wiki-entry');
      const editorEl = document.querySelector('tobor-wiki-entry-editor');
      const spaces = await fetch('/wiki/spaces', {credentials: 'same-origin'}).then((r) => r.json());
      spacesEl.spaces = spaces.spaces;
      spacesEl.addEventListener('wiki-space-select', async (event) => {
        const id = event.detail.id === 'eng' ? 'eng-readme' : event.detail.id;
        entryEl.entry = await fetch('/wiki/entries/' + encodeURIComponent(id), {credentials: 'same-origin'}).then((r) => r.json());
      });
      entryEl.addEventListener('wiki-edit', () => { editorEl.entry = entryEl.entry; });
      editorEl.addEventListener('wiki-save', async (event) => {
        const saved = event.detail;
        const res = await fetch('/wiki/entries/' + encodeURIComponent(saved.id || 'new'), {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(saved),
        });
        entryEl.entry = (await res.json()).entry;
        editorEl.entry = entryEl.entry;
      });
    </script>
  </body>
</html>"#;

async fn index() -> Html<&'static str> {
    Html(PAGE)
}

async fn spaces() -> Json<Value> {
    Json(json!({"spaces": [{"id": "eng", "title": "Engineering", "slug": "eng"}]}))
}

async fn show(Path(id): Path<String>) -> Json<Value> {
    Json(json!({"id": id, "title": "README", "body": "Ship the island.\nDo not render HTML.", "spaceId": "eng"}))
}

async fn update(Json(body): Json<Value>) -> Json<Value> {
    Json(json!({ "ok": true, "entry": body }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index))
        .route("/wiki/spaces", get(spaces))
        .route("/wiki/entries/{id}", get(show).put(update));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
