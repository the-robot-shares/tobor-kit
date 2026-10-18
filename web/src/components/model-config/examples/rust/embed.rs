//! Echo host for `<noizu-model-config>`.
//! Empty `api_key` on PATCH keeps the stored key. Never log keys.
//!
//! [dependencies]
//! axum = "0.8"
//! serde = { version = "1", features = ["derive"] }
//! serde_json = "1"
//! tokio = { version = "1", features = ["macros", "rt-multi-thread"] }

use axum::{
    extract::{Json, State},
    response::Html,
    routing::get,
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

struct Custom {
    base_url: String,
    model: String,
}

struct Store {
    model: String,
    budget: i64,
    custom: Option<Custom>,
    key: String,
}

#[tokio::main]
async fn main() {
    let store = Arc::new(Mutex::new(Store {
        model: "openai:gpt-4o".into(),
        budget: 1000,
        custom: None,
        key: String::new(),
    }));
    let app = Router::new()
        .route("/", get(page))
        .route("/api/v1/ai/models", get(models))
        .route("/api/v1/ai/settings", get(show).patch(update))
        .with_state(store);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn page() -> Html<&'static str> {
    Html(PAGE)
}

async fn models() -> Json<Value> {
    Json(json!({"models": [
        {"provider":"openai","model":"gpt-4o","label":"GPT-4o","spec":"openai:gpt-4o"},
        {"provider":"anthropic","model":"claude-3-5","label":"Claude 3.5","spec":"anthropic:claude-3-5"}
    ]}))
}

fn mask(key: &str) -> String {
    if key.is_empty() {
        return String::new();
    }
    let tail = if key.len() > 4 { &key[key.len() - 4..] } else { key };
    format!("••••{tail}")
}

fn public(s: &Store) -> Value {
    let custom = s.custom.as_ref().map(|c| {
        json!({"base_url": c.base_url, "model": c.model, "api_key": mask(&s.key)})
    });
    json!({"ai": {
        "model": s.model,
        "monthly_budget_cents": s.budget,
        "used_cents": 0,
        "custom_endpoint": custom
    }})
}

async fn show(State(store): State<Arc<Mutex<Store>>>) -> Json<Value> {
    Json(public(&store.lock().unwrap()))
}

#[derive(Deserialize)]
struct Patch {
    ai: Option<Value>,
}

async fn update(State(store): State<Arc<Mutex<Store>>>, Json(body): Json<Patch>) -> Json<Value> {
    let mut s = store.lock().unwrap();
    if let Some(ai) = body.ai {
        if let Some(m) = ai.get("model").and_then(Value::as_str) {
            s.model = m.to_string();
        }
        if let Some(b) = ai.get("monthly_budget_cents").and_then(Value::as_i64) {
            s.budget = b;
        }
        if let Some(c) = ai.get("custom_endpoint") {
            let incoming = c.get("api_key").and_then(Value::as_str).unwrap_or("");
            if !incoming.is_empty() {
                s.key = incoming.to_string();
            }
            s.custom = Some(Custom {
                base_url: c
                    .get("base_url")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                model: c.get("model").and_then(Value::as_str).unwrap_or("").to_string(),
            });
        }
    }
    Json(public(&s))
}

const PAGE: &str = r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>noizu-model-config</title>
    <script type="importmap">
      {"imports":{"lit":"https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js","lit/decorators.js":"https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"}}
    </script>
  </head>
  <body style="font-family:system-ui;background:#12131a;color:#e8e9f0;margin:2rem">
    <noizu-model-config id="model" catalog-url="/api/v1/ai/models" inherit allow-custom allow-budget></noizu-model-config>
    <script type="module">
      import 'https://cdn.derobot.is/tobor-kit/latest/components/model-config/noizu-model-config.js';
      const el = document.querySelector('#model');
      const patch = (ai) => fetch('/api/v1/ai/settings', {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        credentials: 'same-origin', body: JSON.stringify({ai})
      });
      fetch('/api/v1/ai/settings', {credentials:'same-origin'}).then(r => r.json()).then(({ai}) => {
        el.value = ai.model || '';
        el.budget = ai.monthly_budget_cents;
        if (ai.custom_endpoint) el.customEndpoint = {
          baseUrl: ai.custom_endpoint.base_url, model: ai.custom_endpoint.model, apiKey: ai.custom_endpoint.api_key
        };
      });
      el.addEventListener('model-change', e => patch({model: e.detail.value}));
      el.addEventListener('budget-change', e => patch({monthly_budget_cents: e.detail.amount}));
      el.addEventListener('custom-endpoint-save', e => {
        const {baseUrl, model, apiKey} = e.detail;
        patch({custom_endpoint: {base_url: baseUrl, model, api_key: apiKey}});
      });
    </script>
  </body>
</html>
"#;
