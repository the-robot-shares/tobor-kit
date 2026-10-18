//! Serves the tobor-task-menu page and stubs GET /api/tobor-kit/mcp/tools.
//!
//! Production dressing lives in elixir/ and go/. Canned JSON only.
//! Host-owned: secrets, IdP, bearer check when auth.required.

use axum::{response::{Html, Json}, routing::get, Router};
use serde_json::{json, Value};

const PAGE: &str = r#"<!doctype html>
<meta charset="utf-8">
<title>tobor-task-menu</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/task-menu/task-menu.js"></script>
<div class="demo-frame"><tobor-task-menu></tobor-task-menu></div>
<script type="module">
  const el = document.querySelector('tobor-task-menu');
  const token = sessionStorage.getItem('tobor-access-token');
  const headers = token ? {Authorization: 'Bearer ' + token} : {};
  const res = await fetch('/api/tobor-kit/mcp/tools', {headers});
  if (res.ok) el.inventory = await res.json();
  el.addEventListener('tobor-task-select', (e) => {
    console.log('tobor-task-select', e.detail.tool);
  });
</script>
"#;

async fn mcp_tools() -> Json<Value> {
    // Query `refresh` is ignored in this stub; production bypasses the MCP cache.
    Json(json!({
        "groups": [{"id": "Github", "label": "Github"}],
        "tools": [
            {"name": "Github.BranchCreate", "label": "New branch", "group": "Github"},
            {"name": "Github.PullCreate", "label": "Open a PR", "group": "Github", "confirm": true}
        ],
        "degraded": [
            {"server": "tickets", "label": "Tickets", "error": "timeout"}
        ]
    }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/task-menu", get(|| async { Html(PAGE) }))
        .route("/api/tobor-kit/mcp/tools", get(mcp_tools));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8090")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
