//! Minimal JSON-RPC v1 `/auth/socket` stub for `<noizu-auth>`. Not production auth.
//! Host: axum, tokio, serde, serde_json, futures.
//!
//! Six-pipe / merge-flow: this stub does not implement `merge_required` — see
//! docs/backend-requirements.md for the `{merge_required, challenge_id, pipes:[{type,masked}]}`
//! contract a real host must add to login/register/otp-verify when the identifier already
//! belongs to an account under a different pipe.

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    http::header,
    response::{Html, IntoResponse, Redirect},
    routing::get,
    Router,
};
use serde_json::{json, Value};

fn domain_of(email: &Value) -> String {
    let parts: Vec<_> = email.as_str().unwrap_or("").trim().to_lowercase().split('@').collect();
    if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
        parts[1].to_string()
    } else {
        String::new()
    }
}

// Toy region check for the demo — real hosts key this off carrier registration status, not a
// dial-code prefix. Kept in sync with the /auth/sms-regions route below.
const SMS_SUPPORTED_DIAL_PREFIXES: [&str; 2] = ["+1", "+44"];

fn sms_region_supported(mobile_phone: &Value) -> bool {
    match mobile_phone.as_str() {
        None | Some("") => true,
        Some(value) => SMS_SUPPORTED_DIAL_PREFIXES.iter().any(|p| value.starts_with(p)),
    }
}

fn handle_auth_rpc(frame: &Value) -> Value {
    let id = &frame["id"];
    let method = frame["method"].as_str().unwrap_or("");
    let params = &frame["params"];
    if frame["version"] != 1 || !id.is_string() {
        return json!({"id": id, "error": {"code": "invalid_request", "message": "Invalid authentication request."}});
    }
    // Server-side gate — authoritative regardless of the element's client-side `smsRegions`
    // allowlist. See docs/backend-requirements.md's `sms_region_unsupported` contract.
    if matches!(method, "login" | "register" | "otp-request") {
        let mobile_phone = if params["user"].is_object() { &params["user"]["mobile_phone"] } else { &params["mobile_phone"] };
        if !mobile_phone.is_null() && !sms_region_supported(mobile_phone) {
            return json!({"id": id, "error": {"code": "sms_region_unsupported", "message": "SMS is not currently available for this region."}});
        }
    }
    match method {
        "config" => {
            let domain = domain_of(&params["email"]);
            if domain == "noizu.com" {
                json!({"id": id, "result": {
                    "providers": [{"id": "authentik", "label": "Continue with Authentik", "href": "/auth/authentik/start"}],
                    "domain_policies": {"noizu.com": {"providers": ["authentik"]}},
                    "methods": []
                }})
            } else {
                json!({"id": id, "result": {"providers": [], "domain_policies": {}, "methods": if domain.is_empty() { json!([]) } else { json!(["password"]) }}})
            }
        }
        "magic-link" => json!({"id": id, "result": {"status": "pending"}}),
        "otp-request" => json!({"id": id, "result": {}}),
        "login" | "register" | "otp-verify" => {
            json!({"id": id, "result": {"redirect": "/auth/session/finish?code=one-time-host-code"}})
        }
        _ => json!({"id": id, "error": {"code": "invalid_request", "message": "Invalid authentication request."}}),
    }
}

async fn socket(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    while let Some(Ok(Message::Text(text))) = socket.recv().await {
        let frame: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        let _ = socket.send(Message::Text(handle_auth_rpc(&frame).to_string().into())).await;
    }
}

async fn sms_regions() -> impl IntoResponse {
    // Host-owned public config, not part of the /auth/socket RPC surface.
    axum::Json(json!({"supported": ["US", "CA", "GB"], "message": "SMS is not currently available for this region."}))
}

async fn finish() -> impl IntoResponse {
    // HTTP handoff — the only place a session cookie is set. Never on the websocket.
    (
        [(header::SET_COOKIE, "host_session=stub; HttpOnly; Path=/; SameSite=Lax")],
        Redirect::to("/app"),
    )
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(|| async { Html(r#"<!doctype html><meta charset="utf-8"><noizu-auth endpoint="/auth/socket"></noizu-auth>"#) }))
        .route("/auth/socket", get(socket))
        .route("/auth/sms-regions", get(sms_regions))
        .route("/auth/session/finish", get(finish));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// ---------------------------------------------------------------------------
// REST transport option (`transport="rest"`) — the same element, a different wire.
// Most portfolio apps already expose a JSON auth API with Bearer-token sessions instead of
// this WebSocket. Mount the element with transport="rest" api-base="/api/v1" and implement:
//
//   POST {apiBase}/auth/login                  {email, password}
//   POST {apiBase}/auth/register               {user: {email, password, user_name, first_name, last_name, mobile_phone?}, invite_token?}
//   (Element invite-token-mode="required" is UX only — reject token-less register server-side.)
//   POST {apiBase}/auth/mobile/login           {mobile, password}
//   POST {apiBase}/auth/mobile/register        {mobile, password, code, user_name?}
//   POST {apiBase}/auth/otp/email/start        {email}                      -> 202 {status:'sent'}
//   POST {apiBase}/auth/otp/mobile/start       {mobile}                     -> 202 {status:'sent'}
//   POST {apiBase}/auth/otp/email/verify       {email, code}
//   POST {apiBase}/auth/otp/mobile/verify      {mobile, code}
//   GET  {apiBase}/auth/merge/:challenge_id    -> masked description
//   POST {apiBase}/auth/merge/confirm          {challenge_id, proof:{pipe, identifier, password|code}}
//   GET  {apiBase}/auth/config                 optional; any failure degrades to no providers
//
// Success (200 existing / 201 created):
//   {user, organizations, access_token, refresh_token, expires_in}
// Merge challenge: HTTP 409
//   {status:'merge_required', merge_challenge_id, expires_at,
//    available_pipes:[{pipe:'password_email', identifier:'g******@gmail.com'}]}
//   Backend pipe names (password_email / otp_mobile) map to the element's
//   email_password / mobile_otp. `identifier` MUST already be masked.
// Region not SMS-deliverable: HTTP 422 {"error":"sms_region_unsupported"}
//   (the 422 analogue of this socket's error.code of the same name).
// Other errors: {"error":"<code>"} + status — invalid_credentials, invalid_code,
//   expired_code, too_many_attempts, rate_limited, pipe_not_permitted,
//   merge_not_authorized, not_found, invalid_identifier, invalid_password.
//
// The element sends NO cookies in REST mode (credentials: "omit") unless
// with-credentials is set, and it NEVER stores the returned tokens — they arrive
// on auth-success / noizu-auth-success as event.detail.session and the host decides
// where they live. See docs/backend-requirements.md.
