//! Serve the guide-panel mount page.
//!
//! GET /api/tobor-kit/guide is the config projection on the Elixir or Go
//! Guide API (no NPL preamble). This host only serves the tag; reverse-proxy
//! `/api/tobor-kit` to that process. Do not reimplement the service.

use axum::{response::Html, routing::get, Router};

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <body>
    <div class="demo-frame">
      <tobor-guide-panel id="guide" base-url="/api/tobor-kit" placement="floating"></tobor-guide-panel>
    </div>
    <script type="module">
      import "/assets/tobor-kit/guide-panel.js";
      const el = document.getElementById("guide");
      el.token = window.__TOBOR_ACCESS_TOKEN;
      el.addEventListener("tobor-turn-submitted", (event) => {
        console.debug("turn", event.detail);
      });
    </script>
  </body>
</html>"#;

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(|| async { Html(PAGE) }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8090")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
