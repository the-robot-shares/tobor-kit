//! Host snippet: serve a page that mounts the styleguide atoms.
//!
//! No kit API. Cargo: `axum`, `tokio = { version = "1", features = ["full"] }`.
//! Host-owned: persist `sg-click` / `sg-card-select` / `sg-input` in page JS.

use axum::{response::Html, routing::get, Router};

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>styleguide</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-btn.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-card.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-card-grid.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-status.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-input.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-spec-table.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-steps.js"></script>
  </head>
  <body>
    <h1>Styleguide</h1>
    <noizu-sg-btn variant="primary">Continue</noizu-sg-btn>
    <noizu-sg-card-grid columns="3">
      <noizu-sg-card href="/plans">
        <span slot="header">Pro</span>
        Compare features
        <span slot="footer">From $9/mo</span>
      </noizu-sg-card>
      <noizu-sg-card>
        <span slot="header">Docs</span>
        Host-only atom.
      </noizu-sg-card>
      <noizu-sg-card href="/contact">
        <span slot="header">Contact</span>
        preventDefault on sg-card-select to own navigation.
      </noizu-sg-card>
    </noizu-sg-card-grid>
    <noizu-sg-status status="ok" label="Ready" description="All checks passed"></noizu-sg-status>
    <noizu-sg-input name="email" type="email"></noizu-sg-input>
    <noizu-sg-spec-table></noizu-sg-spec-table>
    <noizu-sg-steps current="1"></noizu-sg-steps>
    <script type="module">
      document.querySelector('noizu-sg-btn')?.addEventListener('sg-click', () => {
        console.log('sg-click');
      });
      document.querySelectorAll('noizu-sg-card').forEach((el) => {
        el.addEventListener('sg-card-select', (event) => {
          event.preventDefault();
          console.log('sg-card-select', event.detail);
        });
      });
      document.querySelector('noizu-sg-input')?.addEventListener('sg-input', (event) => {
        console.log('sg-input', event.detail);
      });
      const spec = document.querySelector('noizu-sg-spec-table');
      if (spec) spec.rows = [{key: 'Protocol', value: 'HTTPS'}];
      const stepper = document.querySelector('noizu-sg-steps');
      if (stepper) stepper.steps = ['Plan', 'Build', 'Ship'];
    </script>
  </body>
</html>"#;

async fn styleguide_page() -> Html<&'static str> {
    Html(PAGE)
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(styleguide_page));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
