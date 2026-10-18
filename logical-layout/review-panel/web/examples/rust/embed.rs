//! axum host: serve a page that mounts `<tobor-review-panel>`.
//!
//! GET/POST `/artifacts/{id}/reviews` and POST `…/resolve` are host-owned.
//! Never put a bearer secret on the element.
//! Cargo: `axum`, `serde`, `serde_json`, `tokio = { version = "1", features = ["full"] }`.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Html,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-review-panel</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/review-panel/review-panel.js"></script>
  </head>
  <body>
    <h1>Reviews</h1>
    <div class="demo-frame">
      <tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>
    </div>
    <script type="module">
      const el = document.querySelector('tobor-review-panel');
      const artifactId = el.artifactId || 'artifact-1';
      async function load() {
        const res = await fetch('/artifacts/' + encodeURIComponent(artifactId) + '/reviews', {credentials: 'same-origin'});
        if (!res.ok) return;
        el.reviews = (await res.json()).reviews ?? [];
      }
      el.addEventListener('review-submit', (event) => {
        fetch('/artifacts/' + encodeURIComponent(event.detail.artifactId) + '/reviews', {
          method: 'POST', headers: {'content-type': 'application/json'}, credentials: 'same-origin',
          body: JSON.stringify({body: event.detail.body}),
        }).then((res) => { if (res.ok) return load(); });
      });
      el.addEventListener('review-resolve', (event) => {
        fetch('/artifacts/' + encodeURIComponent(artifactId) + '/reviews/' + encodeURIComponent(event.detail.id) + '/resolve', {
          method: 'POST', credentials: 'same-origin',
        }).then((res) => { if (res.ok) return load(); });
      });
      load();
    </script>
  </body>
</html>"#;

#[derive(Clone, Serialize)]
struct Review {
    id: String,
    author: String,
    body: String,
    at: String,
    status: String,
}

#[derive(Deserialize)]
struct CreateBody {
    body: String,
}

type Store = Arc<Mutex<HashMap<String, Vec<Review>>>>;

async fn index() -> Html<&'static str> {
    Html(PAGE)
}

async fn list(Path(id): Path<String>, State(store): State<Store>) -> Json<Value> {
    let guard = store.lock().expect("store");
    Json(json!({ "reviews": guard.get(&id).cloned().unwrap_or_default() }))
}

async fn create(
    Path(id): Path<String>,
    State(store): State<Store>,
    Json(payload): Json<CreateBody>,
) -> (StatusCode, Json<Review>) {
    let row = Review {
        id: format!("r-{}", now_ms()),
        author: "you".into(),
        body: payload.body,
        at: "2026-01-01T00:00:00Z".into(),
        status: "open".into(),
    };
    store.lock().expect("store").entry(id).or_default().push(row.clone());
    (StatusCode::CREATED, Json(row))
}

async fn resolve(
    Path((artifact_id, review_id)): Path<(String, String)>,
    State(store): State<Store>,
) -> Result<Json<Value>, StatusCode> {
    let mut guard = store.lock().expect("store");
    if let Some(rows) = guard.get_mut(&artifact_id) {
        if let Some(row) = rows.iter_mut().find(|row| row.id == review_id) {
            row.status = "resolved".into();
            return Ok(Json(json!({ "id": review_id, "status": "resolved" })));
        }
    }
    Err(StatusCode::NOT_FOUND)
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

#[tokio::main]
async fn main() {
    let store: Store = Arc::new(Mutex::new(HashMap::from([(
        "artifact-1".into(),
        vec![Review {
            id: "r1".into(),
            author: "Ada".into(),
            body: "Looks good".into(),
            at: "2026-01-01T00:00:00Z".into(),
            status: "open".into(),
        }],
    )])));
    let app = Router::new()
        .route("/", get(index))
        .route("/artifacts/{artifact_id}/reviews", get(list).post(create))
        .route("/artifacts/{artifact_id}/reviews/{id}/resolve", post(resolve))
        .with_state(store);
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
