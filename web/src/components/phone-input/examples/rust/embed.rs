//! Host snippet: serve a page that mounts `<noizu-phone-input>`.
//!
//! No phone API. Cargo: `axum`, `tokio = { version = "1", features = ["full"] }`.
//! Host-owned: uniqueness / OTP. Never put secrets on the element.

use axum::{response::Html, routing::get, Router};

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-phone-input</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/phone-input/noizu-phone-input.js"></script>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; background: #12131a; color: #e8e9f0; }
    </style>
  </head>
  <body>
    <h1>Phone</h1>
    <noizu-phone-input country="US" name="phone"></noizu-phone-input>
    <pre id="log"></pre>
    <script type="module">
      const el = document.querySelector('noizu-phone-input');
      const log = document.querySelector('#log');
      for (const name of ['country-change', 'phone-change', 'phone-invalid']) {
        el.addEventListener(name, (event) => {
          log.textContent = name + ' ' + JSON.stringify(event.detail);
        });
      }
    </script>
  </body>
</html>"#;

async fn phone_input_page() -> Html<&'static str> {
    Html(PAGE)
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(phone_input_page));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
