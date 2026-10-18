//! Host snippet: serve a page that mounts `<noizu-faq>` with slotted details.
//!
//! No FAQ API. Cargo: `axum`, `tokio = { version = "1", features = ["full"] }`.
//! Host-owned: persist `faq-toggle` in page JS if you want analytics.

use axum::{response::Html, routing::get, Router};

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-faq</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/faq/noizu-faq.js"></script>
  </head>
  <body>
    <h1>FAQ</h1>
    <noizu-faq mode="many">
      <details>
        <summary>What is this?</summary>
        <p>A Light DOM island that decorates slotted native details/summary.</p>
      </details>
      <details>
        <summary>Does the host need a backend?</summary>
        <p>No. The island is host-only markup.</p>
      </details>
      <details>
        <summary>Can only one item stay open?</summary>
        <p>Set <code>mode="one"</code> for accordion behavior.</p>
      </details>
    </noizu-faq>
  </body>
</html>"#;

async fn faq_page() -> Html<&'static str> {
    Html(PAGE)
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(faq_page));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
