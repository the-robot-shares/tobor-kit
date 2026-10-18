//! Host page + POST /voice/token proxy for `<tobor-voice-session>`.
//!
//! Production Guide API: `elixir/` (reference) and `go/` (port). This file
//! serves the mount page and proxies `POST /api/tobor-kit/voice/token`.
//! It does not mint credentials. native → 409, none → 503.
//!
//!   TOBOR_KIT_UPSTREAM=http://127.0.0.1:8080
//!
//! cargo add axum reqwest tokio --features tokio/full,reqwest/json

use axum::{
    body::Body,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Router,
};

const PAGE: &str = r#"<!doctype html>
<meta charset="utf-8"/>
<title>tobor-voice-session</title>
<tobor-voice-session id="voice"></tobor-voice-session>
<script type="module">
  import {ToborKitClient} from "https://cdn.derobot.is/tobor-kit/latest/client.js";
  import "https://cdn.derobot.is/tobor-kit/latest/components/voice-session/voice-session.js";
  const el = document.getElementById("voice");
  el.client = new ToborKitClient({baseUrl: "/api/tobor-kit"});
  el.voice = {adapter: "native", locale: "en-US"};
</script>
"#;

#[derive(Clone)]
struct App {
    upstream: String,
    client: reqwest::Client,
}

async fn page() -> Html<&'static str> {
    Html(PAGE)
}

async fn voice_token(State(app): State<App>, headers: HeaderMap) -> Response {
    let url = format!("{}/api/tobor-kit/voice/token", app.upstream);
    let mut req = app.client.post(&url);
    if let Some(auth) = headers.get(axum::http::header::AUTHORIZATION) {
        if let Ok(value) = auth.to_str() {
            req = req.header("Authorization", value);
        }
    }
    match req.send().await {
        Ok(resp) => {
            let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            let ctype = resp
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("application/json")
                .to_owned();
            match resp.bytes().await {
                Ok(bytes) => Response::builder()
                    .status(status)
                    .header("content-type", ctype)
                    .body(Body::from(bytes))
                    .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response()),
                Err(_) => StatusCode::BAD_GATEWAY.into_response(),
            }
        }
        Err(_) => (
            StatusCode::BAD_GATEWAY,
            [("content-type", "application/json")],
            r#"{"code":"upstream_unavailable","message":"start elixir/ or go/ Guide API"}"#,
        )
            .into_response(),
    }
}

#[tokio::main]
async fn main() {
    let upstream = std::env::var("TOBOR_KIT_UPSTREAM")
        .unwrap_or_else(|_| "http://127.0.0.1:8080".into())
        .trim_end_matches('/')
        .to_owned();
    let app = Router::new()
        .route("/", get(page))
        .route("/api/tobor-kit/voice/token", post(voice_token))
        .with_state(App {
            upstream,
            client: reqwest::Client::new(),
        });
    let addr = std::env::var("TOBOR_KIT_HOST_ADDR").unwrap_or_else(|_| "0.0.0.0:8090".into());
    let listener = tokio::net::TcpListener::bind(&addr).await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
