//! Throwaway axum stub of GET /api/tobor-kit/mcp/tools.
//! Production dressing lives in elixir/ and go/. Canned JSON only.
//! Host-owned: TLS, bearer check when guide.auth.required. Never embed secrets.

use axum::{response::{Html, Json}, routing::get, Router};
use serde_json::{json, Value};

async fn mcp_tools() -> Json<Value> {
    // Query `refresh` is ignored in this stub; production bypasses the MCP cache.
    Json(json!({
        "groups": [
            {"id": "Github", "label": "Github"},
            {"id": "Tickets", "label": "Tickets"}
        ],
        "tools": [
            {"name": "Github.BranchCreate", "label": "New branch", "group": "Github", "read_only": true},
            {"name": "Github.PullCreate", "label": "Open a PR", "group": "Github", "confirm": true},
            {"name": "Ticket.Create", "label": "File a ticket", "group": "Tickets"}
        ],
        "degraded": [
            {"server": "seo", "label": "SEO", "error": "connection refused"}
        ]
    }))
}

async fn index() -> Html<&'static str> {
    Html(
        r#"<!doctype html>
<meta charset="utf-8">
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/tool-list/tool-list.js"></script>
<div class="demo-frame"><tobor-tool-list></tobor-tool-list></div>
<script type="module">
  const el = document.querySelector('tobor-tool-list');
  const res = await fetch('/api/tobor-kit/mcp/tools');
  el.inventory = await res.json();
  el.addEventListener('tobor-tool-select', (e) => {
    console.info('tobor-tool-select', e.detail.tool);
  });
</script>"#,
    )
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/tobor-kit/mcp/tools", get(mcp_tools))
        .route("/", get(index));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8090")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
