//! Serves the tobor-telemetry-toggle page.
//!
//! Do not reimplement GET/PUT /telemetry/consent. Reverse-proxy `/api/tobor-kit`
//! to the Elixir or Go Guide API. 403 = not overridable; the element renders
//! nothing. Host-owned: secrets, IdP.

use axum::{response::Html, routing::get, Router};

const PAGE: &str = r#"<!doctype html>
<meta charset="utf-8">
<title>tobor-telemetry-toggle</title>
<tobor-telemetry-toggle></tobor-telemetry-toggle>
<script type="module">
  import {ToborKitClient} from "https://cdn.derobot.is/tobor-kit/latest/client.js";
  import "https://cdn.derobot.is/tobor-kit/latest/components/telemetry-toggle/telemetry-toggle.js";
  const el = document.querySelector("tobor-telemetry-toggle");
  el.client = new ToborKitClient({
    baseUrl: "/api/tobor-kit",
    token: () => sessionStorage.getItem("tobor-access-token")
  });
  el.addEventListener("tobor-telemetry-change", (e) => {
    console.log("tobor-telemetry-change", e.detail.consent);
  });
</script>
"#;

#[tokio::main]
async fn main() {
    let app = Router::new().route("/telemetry-toggle", get(|| async { Html(PAGE) }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8090")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}
