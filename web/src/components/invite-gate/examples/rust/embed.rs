//! axum host: serve /auth/invite-required and a stub POST /api/v1/invites/redeem.
//! Cargo deps: axum, tokio (full), serde (derive), serde_json.

use axum::{http::StatusCode, response::Html, routing::{get, post}, Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

const PAGE: &str = r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>invite required</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/invite-gate/noizu-invite-gate.js"></script>
</head><body><noizu-invite-gate brand="therobotplans" sign-out-url="/logout"></noizu-invite-gate></body></html>"#;

#[derive(Deserialize)]
struct Redeem {
    token: String,
}

// Stub. The real handler authenticates the session, is exempt from the invite gate,
// is rate-limited, and redeems in one transaction.
async fn redeem(Json(body): Json<Redeem>) -> (StatusCode, Json<Value>) {
    match body.token.as_str() {
        "GOOD-INVITE" => (StatusCode::OK, Json(json!({"organization_id": "org-1", "role": "member", "invite_required": false}))),
        "USED-INVITE" => (StatusCode::CONFLICT, Json(json!({"error": "This invite has already been used"}))),
        _ => (StatusCode::NOT_FOUND, Json(json!({"error": "Invalid or expired invite token"}))),
    }
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/auth/invite-required", get(|| async { Html(PAGE) }))
        .route("/api/v1/invites/redeem", post(redeem));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
