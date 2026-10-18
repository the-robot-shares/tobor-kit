"""Minimal JSON-RPC v1 /auth/socket stub for <noizu-auth>. Not production auth.

Six-pipe / merge-flow: this stub does not implement `merge_required` — see
docs/backend-requirements.md for the {merge_required, challenge_id, pipes:[{type,masked}]}
contract a real host must add to login/register/otp-verify when the identifier already
belongs to an account under a different pipe.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, RedirectResponse

app = FastAPI()
METHODS = {"config", "login", "register", "magic-link", "otp-request", "otp-verify"}


def domain_of(email: object) -> str:
    parts = str(email or "").strip().lower().split("@")
    return parts[1] if len(parts) == 2 and parts[0] and parts[1] else ""


# Toy region check for the demo — real hosts key this off carrier registration status, not a
# dial-code prefix. Kept in sync with the /auth/sms-regions route below.
SMS_SUPPORTED_DIAL_PREFIXES = ("+1", "+44")


def sms_region_supported(mobile_phone: object) -> bool:
    value = str(mobile_phone or "")
    return not value or value.startswith(SMS_SUPPORTED_DIAL_PREFIXES)


def handle_auth_rpc(frame: dict) -> dict:
    ident, method, params = frame.get("id"), frame.get("method"), frame.get("params") or {}
    if frame.get("version") != 1 or not isinstance(ident, str) or method not in METHODS:
        return {"id": ident, "error": {"code": "invalid_request", "message": "Invalid authentication request."}}
    # Server-side gate — authoritative regardless of the element's client-side `smsRegions`
    # allowlist. See docs/backend-requirements.md's `sms_region_unsupported` contract.
    mobile_phone = (params.get("user") or {}).get("mobile_phone") or params.get("mobile_phone")
    if method in ("login", "register", "otp-request") and mobile_phone and not sms_region_supported(mobile_phone):
        return {"id": ident, "error": {"code": "sms_region_unsupported", "message": "SMS is not currently available for this region."}}
    if method == "config":
        domain = domain_of(params.get("email"))
        if domain == "noizu.com":
            return {
                "id": ident,
                "result": {
                    "providers": [{"id": "authentik", "label": "Continue with Authentik", "href": "/auth/authentik/start"}],
                    "domain_policies": {"noizu.com": {"providers": ["authentik"]}},
                    "methods": [],
                },
            }
        return {"id": ident, "result": {"providers": [], "domain_policies": {}, "methods": ["password"] if domain else []}}
    if method == "magic-link":
        return {"id": ident, "result": {"status": "pending"}}
    if method == "otp-request":
        return {"id": ident, "result": {}}
    return {"id": ident, "result": {"redirect": "/auth/session/finish?code=one-time-host-code"}}


@app.get("/")
def page() -> HTMLResponse:
    return HTMLResponse(
        '<!doctype html><meta charset="utf-8"><noizu-auth endpoint="/auth/socket"></noizu-auth>'
    )


@app.get("/auth/sms-regions")
def sms_regions() -> dict:
    # Host-owned public config, not part of the /auth/socket RPC surface.
    return {"supported": ["US", "CA", "GB"], "message": "SMS is not currently available for this region."}


@app.get("/auth/session/finish")
def finish() -> RedirectResponse:
    # HTTP handoff — the only place a session cookie is set. Never on the websocket.
    response = RedirectResponse("/app", status_code=303)
    response.set_cookie("host_session", "stub", httponly=True, samesite="lax", path="/")
    return response


@app.websocket("/auth/socket")
async def auth_socket(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            await ws.send_json(handle_auth_rpc(await ws.receive_json()))
    except WebSocketDisconnect:
        return

# ---------------------------------------------------------------------------
# REST transport option (`transport="rest"`) — the same element, a different wire.
# Most portfolio apps already expose a JSON auth API with Bearer-token sessions instead of
# this WebSocket. Mount the element with transport="rest" api-base="/api/v1" and implement:
#
#   POST {apiBase}/auth/login                  {email, password}
#   POST {apiBase}/auth/register               {user: {email, password, user_name, first_name, last_name, mobile_phone?}, invite_token?}
#   (Element invite-token-mode="required" is UX only — reject token-less register server-side.)
#   POST {apiBase}/auth/mobile/login           {mobile, password}
#   POST {apiBase}/auth/mobile/register        {mobile, password, code, user_name?}
#   POST {apiBase}/auth/otp/email/start        {email}                      -> 202 {status:'sent'}
#   POST {apiBase}/auth/otp/mobile/start       {mobile}                     -> 202 {status:'sent'}
#   POST {apiBase}/auth/otp/email/verify       {email, code}
#   POST {apiBase}/auth/otp/mobile/verify      {mobile, code}
#   GET  {apiBase}/auth/merge/:challenge_id    -> masked description
#   POST {apiBase}/auth/merge/confirm          {challenge_id, proof:{pipe, identifier, password|code}}
#   GET  {apiBase}/auth/config                 optional; any failure degrades to no providers
#
# Success (200 existing / 201 created):
#   {user, organizations, access_token, refresh_token, expires_in}
# Merge challenge: HTTP 409
#   {status:'merge_required', merge_challenge_id, expires_at,
#    available_pipes:[{pipe:'password_email', identifier:'g******@gmail.com'}]}
#   Backend pipe names (password_email / otp_mobile) map to the element's
#   email_password / mobile_otp. `identifier` MUST already be masked.
# Region not SMS-deliverable: HTTP 422 {"error":"sms_region_unsupported"}
#   (the 422 analogue of this socket's error.code of the same name).
# Other errors: {"error":"<code>"} + status — invalid_credentials, invalid_code,
#   expired_code, too_many_attempts, rate_limited, pipe_not_permitted,
#   merge_not_authorized, not_found, invalid_identifier, invalid_password.
#
# The element sends NO cookies in REST mode (credentials: "omit") unless
# with-credentials is set, and it NEVER stores the returned tokens — they arrive
# on auth-success / noizu-auth-success as event.detail.session and the host decides
# where they live. See docs/backend-requirements.md.
