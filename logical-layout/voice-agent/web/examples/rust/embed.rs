//! axum host for `<tobor-voice-agent>`.
//! Production voice is `backend/` (Node). This stubs `POST /voice/sessions` + ready/transcript.
//! cargo add axum serde serde_json tokio --features axum/ws,tokio/full
//! Reverse-proxy alternative: forward `/voice/` to `VOICE_GATEWAY_URL` (default http://127.0.0.1:8081).

use axum::{
    extract::{ws::WebSocketUpgrade, Path},
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::net::SocketAddr;

const PAGE: &str = r#"<!doctype html><meta charset="utf-8"><title>tobor-voice-agent</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/voice-agent/voice-agent.js"></script>
<tobor-voice-agent organization="acme" project="app" backend="litellm" engine="tts" model="gpt-4o-mini" label="Voice agent"></tobor-voice-agent>
<script type="module">
  const agent = document.querySelector('tobor-voice-agent');
  agent.backendUrl = location.origin;
  agent.tools = []; agent.mcpTools = [];
</script>"#;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(|| async { Html(PAGE) }))
        .route("/voice/sessions", post(create_session))
        .route("/voice/sessions/{id}/socket", get(socket));
    let addr = SocketAddr::from(([127, 0, 0, 1], 8091));
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}

/// Host-owned auth belongs here. Never return provider API keys.
async fn create_session() -> impl IntoResponse {
    let session_id = format!(
        "{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    (
        StatusCode::CREATED,
        Json(json!({
            "sessionId": session_id,
            "websocketUrl": format!("ws://127.0.0.1:8091/voice/sessions/{session_id}/socket")
        })),
    )
}

async fn socket(Path(id): Path<String>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |mut socket| async move {
        use axum::extract::ws::Message;
        let ready = json!({"type":"ready","sessionId": id}).to_string();
        let _ = socket.send(Message::Text(ready.into())).await;
        while let Some(Ok(Message::Text(text))) = socket.recv().await {
            let msg: Value = serde_json::from_str(&text).unwrap_or(json!({}));
            let kind = msg.get("type").and_then(Value::as_str).unwrap_or("");
            if kind == "interrupt" {
                let _ = socket
                    .send(Message::Text(json!({"type":"interrupted"}).to_string().into()))
                    .await;
                continue;
            }
            if !kind.starts_with("input.") {
                continue;
            }
            let user = msg.get("text").and_then(Value::as_str).unwrap_or("[input]");
            for frame in [
                json!({"type":"animation","state":"thinking"}),
                json!({"type":"transcript","role":"user","text":user,"final":true}),
                json!({"type":"transcript","role":"assistant","text":format!("stub: {user}"),"final":true}),
                json!({"type":"text","text":format!("stub: {user}"),"final":true}),
                json!({"type":"animation","state":"idle"}),
            ] {
                let _ = socket.send(Message::Text(frame.to_string().into())).await;
            }
        }
    })
}
