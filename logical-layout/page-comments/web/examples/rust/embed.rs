// axum host for <noizu-page-comments>: serves the page plus a minimal
// read-side stub of the annotate contract for local development. Production
// storage lives in the annotate service — docs/backend-requirements.md.
use axum::{
    extract::{Path, Query},
    response::Html,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;

#[derive(Deserialize)]
struct ThreadQuery {
    #[serde(default)]
    page_key: String,
}

async fn index() -> Html<&'static str> {
    Html(
        r#"<!doctype html>
<html><head><meta charset="utf-8"><title>page-comments host</title>
<script type="module">
import "https://cdn.derobot.is/tobor-kit/latest/components/page-comments/page-comments.js";
</script></head>
<body>
<h1>Annotatable page</h1>
<p id="intro">Enable comments (launcher or Alt+C), then click to anchor.</p>
<noizu-page-comments site="demo-site" api-base="http://127.0.0.1:3000"></noizu-page-comments>
</body></html>"#,
    )
}

async fn threads(Path(site): Path<String>, Query(q): Query<ThreadQuery>) -> Json<serde_json::Value> {
    // Dev stub: empty list per page_key.
    Json(json!({ "threads": [], "site": site, "page_key": q.page_key }))
}

#[tokio::main]
async fn main() {
    let _guard: HashMap<String, String> = HashMap::new(); // dev state placeholder
    let app = Router::new()
        .route("/", get(index))
        .route("/api/v1/sites/:site/threads", get(threads));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
