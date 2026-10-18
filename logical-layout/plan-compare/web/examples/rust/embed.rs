//! axum host: serve `<noizu-plan-compare>` with sample plans JSON.
//! Does not create Stripe sessions. Host-owned: navigate on `plan-select`.

use axum::{response::Html, routing::get, Router};
use tokio::net::TcpListener;

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-plan-compare</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/plan-compare/noizu-plan-compare.js"></script>
  </head>
  <body>
    <noizu-plan-compare layout="cards" billing-toggle checkout-url-template="https://example.com/checkout/{planId}">
      <script type="application/json">
        [
          {"id":"starter","name":"Starter","priceMonthly":9,"priceYearly":90,"features":["1 seat","Community support"]},
          {"id":"pro","name":"Pro","priceMonthly":29,"priceYearly":290,"features":["5 seats","Priority support"],"highlighted":true,"ctaLabel":"Go Pro"},
          {"id":"team","name":"Team","priceMonthly":99,"priceYearly":990,"features":["Unlimited seats","SSO"]}
        ]
      </script>
    </noizu-plan-compare>
    <pre id="log"></pre>
    <script type="module">
      document.querySelector('noizu-plan-compare').addEventListener('plan-select', (event) => {
        document.querySelector('#log').textContent = JSON.stringify(event.detail);
        // Host-owned: location.assign(event.detail.checkoutUrl). Do not create Stripe sessions here.
      });
    </script>
  </body>
</html>"#;

async fn index() -> Html<&'static str> {
    Html(PAGE)
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(index));
    let listener = TcpListener::bind("127.0.0.1:8080").await.expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
