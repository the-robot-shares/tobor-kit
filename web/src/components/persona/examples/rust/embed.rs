//! Host snippet: serve a page that mounts `<tobor-persona-card>` and `<tobor-persona-picker>`.
//!
//! No persona API. Cargo: `axum`, `tokio = { version = "1", features = ["full"] }`.
//! Host-owned: roster + routing. Never put secrets on the element.

use axum::{response::Html, routing::get, Router};

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-persona-card / tobor-persona-picker</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/robot-avatar/robot-avatar.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/persona/persona-card.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/persona/persona-picker.js"></script>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 48rem; margin: 2rem auto; padding: 0 1rem; background: #12131a; color: #e8e9f0; display: grid; gap: 12px; }
    </style>
  </head>
  <body>
    <h1>Personas</h1>
    <tobor-persona-card persona-id="nova" display-name="Nova" handle="@nova">
      <tobor-robot-avatar slot="avatar" state="idle" label="Nova"></tobor-robot-avatar>
    </tobor-persona-card>
    <tobor-persona-picker query=""></tobor-persona-picker>
    <pre id="log"></pre>
    <script type="module">
      const card = document.querySelector('tobor-persona-card');
      const picker = document.querySelector('tobor-persona-picker');
      const log = document.querySelector('#log');
      picker.personas = [
        {id: 'nova', name: 'Nova', handle: '@nova'},
        {id: 'orbit', name: 'Orbit', handle: '@orbit'},
        {id: 'pip', name: 'Pip'},
      ];
      const onSelect = (event) => {
        log.textContent = 'persona-select ' + JSON.stringify(event.detail);
      };
      card.addEventListener('persona-select', onSelect);
      picker.addEventListener('persona-select', onSelect);
    </script>
  </body>
</html>"#;

async fn persona_page() -> Html<&'static str> {
    Html(PAGE)
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(persona_page));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
