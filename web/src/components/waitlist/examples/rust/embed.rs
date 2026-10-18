// ForYou-compatible host for <noizu-waitlist>.
// [dependencies]
// axum = "0.8"
// serde = { version = "1", features = ["derive"] }
// serde_json = "1"
// tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
// tower-http = { version = "0.6", features = ["cors"] }

use axum::extract::Path;
use axum::http::{header, Method, StatusCode};
use axum::response::Html;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};

#[derive(Deserialize)]
struct Signup {
    values: Option<Value>,
    source: Option<String>,
    #[serde(default)]
    company_website: String,
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::ACCEPT, header::CONTENT_TYPE]);
    let app = Router::new()
        .route("/", get(page))
        .route("/api/v1/public/lists/{slug}", get(get_list))
        .route("/api/v1/public/lists/{slug}/signups", post(post_list))
        .route(
            "/api/v1/public/services/{service}/lists/{list}",
            get(get_service_list),
        )
        .route(
            "/api/v1/public/services/{service}/lists/{list}/signups",
            post(post_service),
        )
        .layer(cors);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn page() -> Html<&'static str> {
    Html(
        r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-waitlist</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/waitlist/noizu-waitlist.js"></script>
    <style>
      body{font-family:system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem}
      .field-group{display:grid;gap:.25rem;margin:.5rem 0}
      .field-input,.field-select,.field-textarea{padding:.4rem}
      .btn{padding:.4rem .8rem;cursor:pointer}
      .success{color:#0a0}.danger{color:#c00}
    </style>
  </head>
  <body>
    <noizu-waitlist slug="my-site" source="landing"></noizu-waitlist>
    <script type="module">
      const el = document.querySelector('noizu-waitlist');
      el.api = location.origin;
      el.addEventListener('waitlist-success', ev => console.info('waitlist-success', ev.detail));
      el.addEventListener('waitlist-error', ev => console.warn('waitlist-error', ev.detail));
    </script>
  </body>
</html>"#,
    )
}

fn manifest(name: &str) -> Value {
    json!({"list": {
        "name": name,
        "description": "Join the waitlist.",
        "opt_in_mode": "single",
        "settings": {"success_message": "You're on the list!"},
        "attributes": [{"slug":"email","name":"Email","type":"email","required":true,"is_identity":true,"sort_order":0}]
    }})
}

async fn get_list(Path(slug): Path<String>) -> Json<Value> {
    Json(manifest(&slug))
}

async fn get_service_list(Path((service, list)): Path<(String, String)>) -> Json<Value> {
    Json(manifest(&format!("{service}/{list}")))
}

async fn post_list(Path(slug): Path<String>, Json(body): Json<Signup>) -> (StatusCode, Json<Value>) {
    accept(&slug, body)
}

async fn post_service(
    Path((service, list)): Path<(String, String)>,
    Json(body): Json<Signup>,
) -> (StatusCode, Json<Value>) {
    accept(&format!("{service}/{list}"), body)
}

fn accept(id: &str, body: Signup) -> (StatusCode, Json<Value>) {
    if body.company_website.trim().is_empty() {
        eprintln!(
            "waitlist signup list={id} source={} values={:?}",
            body.source.as_deref().unwrap_or("widget"),
            body.values
        );
    }
    (StatusCode::ACCEPTED, Json(json!({"accepted": true})))
}
