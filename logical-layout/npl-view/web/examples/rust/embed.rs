//! axum host: serve <tobor-npl-view>.
//! No kit API. Host-owned: set source. Never put secrets on the element.
//!
//! [dependencies]
//! axum = "0.8"
//! tokio = { version = "1", features = ["macros", "rt-multi-thread"] }

use axum::{response::Html, routing::get, Router};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-npl-view</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/npl-view/npl-view.js"></script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <h1>NPL view</h1>
    <div class="demo-frame">
      <tobor-npl-view id="npl"></tobor-npl-view>
    </div>
    <pre id="log"></pre>
    <script type="module">
      const el = document.querySelector('#npl');
      const log = document.querySelector('#log');
      el.source = `⌜NPL@1.0⌝

# Syntax
Greet {user.name} with [...:1sentence| warm].
Use 🎯 care.

# Agent
⌜guide|agent|NPL@1.0⌝
You are a helpful guide.
⌞guide⌟
`;
      el.addEventListener('npl-copy', (event) => {
        log.textContent = JSON.stringify({copy: event.detail});
      });
    </script>
  </body>
</html>"#;

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(index));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

async fn index() -> Html<&'static str> {
    Html(PAGE)
}
