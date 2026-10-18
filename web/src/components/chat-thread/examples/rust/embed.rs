//! Serve the chat-thread mount page.
//!
//! Transcript is GET/DELETE /api/tobor-kit/sessions/{sessionId}/transcript
//! on the Elixir or Go Guide API. This host only serves the tag; it does
//! not reimplement the store. 501 = client store (memory/local), not empty.

use axum::{response::Html, routing::get, Router};

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <body>
    <div class="demo-frame">
      <tobor-chat-thread show-composer></tobor-chat-thread>
    </div>
    <script type="module">
      import {ToborKitClient} from "/assets/tobor-kit/client.js";
      import {createBackendStore, createMemoryStore} from "/assets/tobor-kit/transcript-store.js";
      import "/assets/tobor-kit/chat-thread.js";
      const el = document.querySelector("tobor-chat-thread");
      const sessionId = new URLSearchParams(location.search).get("session");
      el.addEventListener("tobor-transcript-clear", () => {
        el.turns = [];
        el.messages = [];
        el.load = null;
      });
      el.addEventListener("thread-send", (event) => {
        console.info("thread-send", event.detail.text);
      });
      if (sessionId) {
        const store = createBackendStore(new ToborKitClient({
          baseUrl: "/api/tobor-kit",
          token: () => window.__TOBOR_ACCESS_TOKEN
        }), sessionId);
        const load = await store.load();
        el.store = store;
        el.load = load;
        if (load.status === "ok") el.turns = load.turns;
      } else {
        const store = createMemoryStore();
        el.store = store;
        el.turns = (await store.load()).turns;
      }
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
