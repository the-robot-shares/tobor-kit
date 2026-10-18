//! axum host: serve both artifact tags.
//! Host-owned persistence. Kit does not PUT. No secrets on the element.
//!
//! [dependencies]
//! axum = "0.8"
//! serde = { version = "1", features = ["derive"] }
//! serde_json = "1"
//! tokio = { version = "1", features = ["macros", "rt-multi-thread"] }

use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::Html,
    routing::{get, post},
    Router,
};
use serde::Serialize;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;

#[derive(Clone, Serialize)]
struct Artifact {
    id: String,
    title: String,
    version: i64,
    body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    mime: Option<String>,
}

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>artifact family</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-view.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-editor.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <tobor-artifact-view id="view"></tobor-artifact-view>
    <tobor-artifact-editor id="editor"></tobor-artifact-editor>
    <script type="module">
      const view = document.querySelector('#view');
      const editor = document.querySelector('#editor');
      const apply = (artifact) => { view.artifact = artifact; editor.artifact = artifact; };
      fetch('/artifacts/demo', {credentials: 'same-origin'}).then((r) => r.json()).then(apply);
      view.addEventListener('review-start', (event) => {
        fetch('/reviews', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        });
      });
      editor.addEventListener('artifact-save', (event) => {
        const id = event.detail.id || 'demo';
        fetch('/artifacts/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify(event.detail),
        }).then((r) => r.json()).then(apply);
      });
    </script>
  </body>
</html>"#;

#[tokio::main]
async fn main() {
    let store = Arc::new(Mutex::new(Artifact {
        id: "demo".into(),
        title: "Release notes".into(),
        version: 1,
        body: "Ship the island.\nDo not render HTML.".into(),
        mime: Some("text/plain".into()),
    }));
    let app = Router::new()
        .route("/", get(index))
        .route("/artifacts/{id}", get(show).put(update))
        .route("/reviews", post(review))
        .with_state(store);
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

async fn index() -> Html<&'static str> {
    Html(PAGE)
}

async fn show(
    Path(id): Path<String>,
    State(store): State<Arc<Mutex<Artifact>>>,
) -> Result<Json<Artifact>, StatusCode> {
    let art = store.lock().expect("lock").clone();
    if art.id != id {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(Json(art))
}

async fn update(
    Path(id): Path<String>,
    State(store): State<Arc<Mutex<Artifact>>>,
    Json(body): Json<Value>,
) -> Json<Artifact> {
    let mut art = store.lock().expect("lock");
    art.id = id;
    if let Some(title) = body.get("title").and_then(|v| v.as_str()) {
        if !title.is_empty() {
            art.title = title.to_string();
        }
    }
    if let Some(text) = body.get("body").and_then(|v| v.as_str()) {
        art.body = text.to_string();
    }
    if let Some(mime) = body.get("mime").and_then(|v| v.as_str()) {
        art.mime = Some(mime.to_string());
    }
    art.version += 1;
    Json(art.clone())
}

async fn review(Json(body): Json<Value>) -> Json<Value> {
    Json(json!({ "ok": true, "review": body }))
}
