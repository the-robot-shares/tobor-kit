# `noizu-auth` backend requirements

`backend: auth`. The element supports **two transports** behind one internal contract. Pick with the `transport` attribute.

| `transport` | Host must provide | Session model |
|---|---|---|
| unset (**default**) / `socket` | Same-host authentication WebSocket at `endpoint` + prelogin binding + `/auth/session/finish` handoff. Protocol: [docs/auth-socket.md](../../../../../../docs/auth-socket.md). | Host **cookie**. The element never sees a token. |
| `rest` | JSON auth API under `{api-base}` (default `/api/v1`), per [§ REST transport](#rest-transport-transportrest). | **Bearer tokens** in the response body, emitted to the host. |

**Which to pick.** Choose `socket` when the host owns an HttpOnly session cookie and can install the Elixir adapter — it keeps tokens out of JavaScript entirely, which is the stronger posture. Choose `rest` when the app already exposes the portfolio `/api/v1/auth/*` contract (therobotplans.com and most portfolio apps do) or when a WebSocket is impractical (edge/CDN fronting, no persistent connection budget); the trade-off is that tokens now exist in page memory and the host must decide where they live.

The element carries **no secrets** and must not be given client secrets, API keys, or session tokens as attributes. Under **either** transport it never writes a token to `localStorage`, `sessionStorage`, IndexedDB, or a cookie.

Sections below up to [§ REST transport](#rest-transport-transportrest) describe the **socket** transport.

## What the host must provide (socket transport)

1. An **anonymous** `GET /auth/socket` WebSocket on the page host (not the product Phoenix `/socket`).
2. An HTTP pre-login session that already holds a cryptographically random `auth_browser_binding` (16–256 bytes) **before** any socket, including `config`.
3. A one-time HTTP handoff route that **sets the session cookie**. The WebSocket **never** `Set-Cookie`.
4. Provider start/callback HTTP routes when SSO is advertised. Those flows stay on the server.

Production implementation: `elixir/lib/tobor_kit/components/auth/socket.ex` (`ToborKit.Auth.SocketPlug`, `ToborKit.Auth.Socket`). Optional OIDC helper: `ToborKit.Auth.OIDC` in `oidc.ex`. Family `examples/` for go/python/ts/js/rust are protocol stubs, not account services.

## Auth

Anonymous upgrade. The browser may send its pre-login **HttpOnly** cookie; the element never reads it. A trusted host plug copies only the opaque binding:

```elixir
Plug.Conn.put_private(conn, :tobor_auth_context, %{browser_binding: binding})
```

Missing, extra, or malformed context → **403** before upgrade. Origins must match scheme, host, and port. Development may pass `development: true, allowed_origins: ["http://localhost:5173"]` for a same-host, same-scheme frontend port. Foreign hosts and scheme changes fail closed.

No bearer token on this socket.

## WebSocket `GET /auth/socket`

Upgrade path default `/auth/socket` (component `endpoint`). HTTPS pages use WSS. Non-GET → 405. Bandit `max_frame_size: 16_384`. Adapter: 16 KiB frames, 60 requests/connection, 60s idle, no retained credentials.

Each text frame:

```json
{"version": 1, "id": "request-id", "method": "login", "params": {}}
```

Reply:

```json
{"id": "request-id", "result": {}}
```

or

```json
{"id": "request-id", "error": {"code": "invalid_email", "message": "Enter a valid email address."}}
```

Unknown methods, bad envelopes, handler exceptions, and results that contain credential keys (`password`, `access_token`, `refresh_token`, `client_secret`, `dev_code`, `dev_link`, `browser_binding`, nested) fail closed with a public error.

### Methods the element calls

| Method | Params | Result |
|--------|--------|--------|
| `config` | `{}` or `{email}` | `{providers: [{id, label?, href}], domain_policies, methods?}` (`domains` accepted as an alias of `domain_policies`) |
| `login` | `{email, password}` | `{redirect}` (preferred), or `{authenticated: true}` only if the HTTP session is already established, or `{status: "pending"}` |
| `register` | `{user: {email, password, user_name, first_name, last_name, mobile_phone}, invite_token}` | `{redirect}` or `{status: "pending"}` |
| `magic-link` | `{email}` | notice / pending; verification continues over HTTP |
| `otp-request` | `{email}` | empty / ok (element then collects `code`) |
| `otp-verify` | `{email, code}` | `{redirect}` (preferred) |

`href` and `redirect` must be **root-relative** (`/auth/...`). No protocol-relative URLs, backslashes, or whitespace. The Elixir adapter also accepts `sso`; the element does not call it — it follows provider `href` over HTTP.

`config` without email may return empty `providers` / `methods`. With `{email}`, return the authoritative snapshot for that exact domain (case-insensitive equality, not suffix matching). Discovery is not an account-existence oracle. A domain-mandated provider must not include password as a fallback. Re-enforce the same policy on `login` / `register` / OTP / magic-link / provider-start.

### `invite_token` policy (`invite-token-mode` on the element)

`register` carries an optional top-level `invite_token` (the element strips it from `user`). The element's `invite-token-mode` attribute is presentation policy; hosts enforce their own semantics per mode:

- `optional` (default): validate the token if present; registration works without one.
- `optional` set explicitly — **the backend contract is identical to the default**; "explicit" is only the front-end opt-in to the routing below (the invite interstitial, see the monorepo `docs/invite-interstitial/PATTERN.md`): `register` without a code creates the account `pending` and answers success with `user.invite_required: true` (REST: in the session `user`). The element routes that account to `invite-required-url`. An `invite_required` error code on `register` is routed the same way instead of being shown. A supplied but **invalid** code must still fail with the existing invalid-token error and write no row.
- `required`: the host MUST reject `register` with a missing or invalid token — the element's client-side required flag and `inviteRequired` copy are UX only, and the server is authoritative. Socket transport: `{"error": {"code": "invalid_invite_token", "message": "..."}}` on the request envelope. REST transport: `422 {"error": "invalid_invite_token"}` — same convention as the other error codes below. Reject before any account-creation work.
- `hidden`: the element omits `invite_token` from `register` entirely. Hosts that hard-gate signup on invites should use `required` instead, so the UI matches the policy instead of failing opaquely after submit.

Mobile register (`POST /auth/mobile/register`) carries no `invite_token`; unchanged. The reference Elixir adapter exposes the same knob: `ToborKit.Auth.SocketPlug` accepts `invite_token: :optional | :required | :ignore` (default `:optional`, today's passthrough; unknown values clamp to `:optional`).

### Six-pipe mode (`pipes` set on the element)

When the host enables `pipes`, the element calls the same `login` / `register` / `otp-request` / `otp-verify` methods above, with the identifier keyed by pipe type instead of always `email`:

| Pipe | Identifier param |
|------|-------------------|
| `email_password`, `email_otp` | `{email}` |
| `mobile_password`, `mobile_otp` | `{mobile_phone}` (E.164, from `<noizu-phone-input>`) |
| `google`, `authentik`, `github` | No socket call — the element follows `config.providers` `href` for `id: "google"` / `id: "authentik"` / `id: "github"`, same as any other SSO provider. |

The host maps `mobile_phone` identifiers onto the same account model as `email` — this element does not assume a separate mobile-only account type.

### Merge challenge (account already exists under a different pipe)

`login`, `register`, and `otp-verify` may return, instead of the normal result:

```json
{"merge_required": true, "challenge_id": "opaque-id", "pipes": [{"type": "google", "masked": "g****@gmail.com"}]}
```

`pipes` lists the account's **existing** pipes as `{type, masked}`. `masked` must always be a masked identifier — **never** send an unmasked one; the element renders exactly what it is given and never assumes it has more. `challenge_id` is opaque, short-lived, and bound to the pending merge attempt (bind it to the same browser/session context used for the rest of this socket, the same way the completion handoff is bound to `browser_binding`).

The element then re-submits `login` / `otp-request` + `otp-verify` for the pipe the user chooses, with an added param:

```json
{"email": "...", "password": "...", "merge_challenge_id": "opaque-id"}
```

The host must verify that request against the **existing** pipe's real credentials (not the new one), and only on success:

- Link the new pipe to the existing account.
- Return `{"merge_confirmed": true}` (or `{"authenticated": true}` if the HTTP session is already established) so the element can emit `noizu-auth-merge-confirmed` and complete via the normal HTTP handoff.

Until that reply, the new pipe **is not active** and **no session exists** — do not link the account or start a session on the strength of the merge-required response alone. An SSO pipe (`google`/`authentik`/`github`) confirms by following its provider `href` with `?merge_challenge_id=<id>` appended by the element; the provider callback route must read and enforce that parameter the same way.

### Completion — HTTP handoff, never `Set-Cookie` from WS

On successful login, registration, or OTP verify, issue a **short-lived, single-use** code **bound to `context.browser_binding`** and return:

```json
{"redirect": "/auth/session/finish?code=..."}
```

Optional public user fields may sit beside `redirect`; never tokens. The element emits `auth-redirect` `{url}` and `location.assign`s same-origin HTTP(S) only.

Host `GET /auth/session/finish?code=...`:

1. Read this browser’s pre-login session nonce.
2. Verify the code is bound to that nonce (prevents login CSRF).
3. Atomically redeem (single use).
4. Rotate the session id, clear the pre-login binding, **Set-Cookie** (HttpOnly, Secure, host CSRF rules).
5. Redirect to profile completion, pending approval, or a safe path.

A websocket cannot set an HttpOnly cookie after upgrade. **Never `Set-Cookie` from the socket.** Magic links stay on the product’s HTTP verify flow.


---

## REST transport (`transport="rest"`)

Selected with `transport="rest"`; base path from `api-base` (default `/api/v1`, validated same-origin exactly like `endpoint`). Reference implementation of this contract: therobotplans.com `docs/auth-pipes.md` § 7 (`AuthPipeController`).

### Endpoints the element calls

| Element method | HTTP | Body |
|---|---|---|
| `config` (discovery) | `GET {apiBase}/auth/config` | — |
| `login` (email pipes) | `POST {apiBase}/auth/login` | `{email, password}` |
| `login` (mobile pipes) | `POST {apiBase}/auth/mobile/login` | `{mobile, password}` |
| `register` (email pipes) | `POST {apiBase}/auth/register` | `{user: {email, password, user_name, first_name, last_name, mobile_phone?}, invite_token?}` — mirrors the socket `register` params 1:1 (nested `user`, key `mobile_phone`, `invite_token` top-level and omitted when unset) |
| `register` (mobile-first) | `POST {apiBase}/auth/mobile/register` | `{mobile, password, code, user_name?}` |
| `otp-request` | `POST {apiBase}/auth/otp/{mobile,email}/start` | `{mobile}` / `{email}` |
| `otp-verify` | `POST {apiBase}/auth/otp/{mobile,email}/verify` | `{mobile, code}` / `{email, code}` |
| merge description (optional) | `GET {apiBase}/auth/merge/:challenge_id` | — |
| merge confirmation | `POST {apiBase}/auth/merge/confirm` | `{challenge_id, proof: {pipe, identifier, password \| code}}` |

`GET /auth/config` is **optional**: any failure (404, 500, network) degrades to an empty config — no providers, no domain policy — rather than blocking the form. Discovery is advisory; the server re-enforces policy on every submit. When present, return the same shape the socket `config` method returns: `{providers: [{id, label?, href}], domain_policies}`.

`magic-link` has no REST equivalent. The element refuses it locally with code `unsupported_method` and makes no request.

### Session response (Bearer)

`200` (existing account) or `201` (created), with at least:

```json
{"user": {...}, "organizations": [...], "access_token": "…", "refresh_token": "…", "expires_in": 3600}
```

The element normalizes this to `{authenticated: true, session: {tokenType: "Bearer", accessToken, refreshToken, expiresIn, user, organizations}}` and emits `session` on `auth-success` and `noizu-auth-success`.

> **The component MUST NOT and does not persist tokens.** It writes nothing to `localStorage`, `sessionStorage`, IndexedDB, or a cookie, and keeps no copy after the event dispatches. Token storage is a security-relevant decision with application-specific trade-offs — XSS blast radius, per-tab vs. shared scope, refresh rotation, logout and revocation semantics, whether a service worker or a backend-for-frontend should hold it instead. A reusable island cannot know which of those apply, so it hands the session to the host exactly once and forgets it. Hosts that want the strongest posture should use the **socket** transport with an HttpOnly cookie instead.

### Credentials and CSRF

Requests are sent with **`credentials: "omit"`** unless the host sets `with-credentials`.

A Bearer API needs no ambient session, and attaching one to an unauthenticated `POST /auth/login` makes a cross-site submission indistinguishable from a first-party one — login CSRF, where an attacker silently signs a victim into an attacker-controlled account. Omitting cookies removes that class of attack from this element entirely and keeps the requests out of CORS' credentialed mode. `with-credentials` exists only for hosts whose REST auth genuinely is cookie-session based; **those hosts must supply their own CSRF token handling — this element does not send one.**

The element never sets an `Authorization` header of its own: it has no token before sign-in, and it does not retain one after.

### `merge_required` — HTTP 409

```json
{
  "status": "merge_required",
  "merge_challenge_id": "4f6d…",
  "expires_at": "2026-09-08T05:31:00Z",
  "available_pipes": [
    {"pipe": "password_email", "identifier": "g******@gmail.com"},
    {"pipe": "otp_mobile",     "identifier": "+1***-***-4821"}
  ]
}
```

Both markers are honoured: HTTP status **409** *and* `status: "merge_required"`. The element maps this onto the identical internal state the socket transport's `{merge_required: true, challenge_id, pipes: [{type, masked}]}` produces:

| REST `pipe` | element pipe id |
|---|---|
| `password_email` | `email_password` |
| `password_mobile` | `mobile_password` |
| `otp_email` | `email_otp` |
| `otp_mobile` | `mobile_otp` |
| `google`, `authentik`, `github` | unchanged |

`identifier` becomes `masked` and is rendered verbatim — it **must always be masked**. `access_token`, `refresh_token`, `user` and raw identifiers must be absent from a 409. The element then collects the chosen existing pipe's credential and calls `POST /auth/merge/confirm` with `{challenge_id, proof: {pipe, identifier, password|code}}`, expecting a session response (§ Session response) on success. Until that response, no session exists and the new pipe must not be linked.

### Error bodies

REST errors carry a code and no prose: `{"error": "<code>"}` with an HTTP status. The transport maps known codes onto public copy so the banner reads identically to the socket transport's `error.message`:

`invalid_identifier` · `invalid_credentials` · `invalid_password` · `invalid_code` · `expired_code` · `too_many_attempts` · `rate_limited` · `pipe_not_permitted` · `merge_not_authorized` · `not_found` · `sms_region_unsupported`

A server-supplied `message` (or `error.message`) wins when present. An unrecognized code passes through as-is; a non-JSON or empty body becomes `http_<status>` with generic copy. Network failure → `network_error`; timeout (15 s) → `timeout`.

### `sms_region_unsupported` — HTTP 422

```
422 {"error": "sms_region_unsupported", "message": "SMS is not currently available for this region."}
```

Exactly the socket transport's `error.code: "sms_region_unsupported"` (documented above), carried as an HTTP status instead of an envelope error. The element renders the message in the inline notice beside the phone input — never the generic error banner — and emits `noizu-auth-sms-region-unsupported` `{pipe, message}`. Reject before any password/OTP verification work, so an unsupported region never causes a wasted SMS send or partial account state. The optional host-owned region-config endpoint described above is unchanged and equally applicable here.

### What the host still owns under REST

Rate limiting, enumeration defences, OTP throttling, domain policy, account lockout, token rotation and revocation, and **where the returned tokens are stored**. The element is presentation only.

---

## What the component does not do

- Session cookies, CSRF tokens, or `Set-Cookie`
- **Storing tokens.** No `localStorage`, `sessionStorage`, IndexedDB, or cookie writes under either transport — the REST session is emitted to the host and dropped
- OAuth/OIDC/SAML code exchange or client secrets
- Foreign redirects or protocol-relative provider URLs
- Emitting passwords, access/refresh tokens, or `browser_binding`
- Rate limiting, account lockout, or domain-policy enforcement (presentation only)
- Inventing accounts; host maps `handle_auth/3` onto existing `/api/v1/auth/*` (or equivalent)

## Error codes

Public `error.code` / `error.message` only. Typical: `invalid_request`, `invalid_email`, `invalid_response`, `unavailable`, plus host codes. Do not leak exceptions or credentials in `message`.

### `sms_region_unsupported` (SMS-region gating)

Some hosts can only deliver SMS in certain regions — e.g. carrier registration such as US A2P 10DLC is incomplete, or a provider route is not yet live for that country. When the host enables the element's `smsRegions` property, the component performs a client-side check (UX only) before submitting a `mobile_password` / `mobile_otp` pipe. **The server remains authoritative regardless of `smsRegions`** and must independently reject `login` / `register` / `otp-request` for an unsupported `mobile_phone` region with:

```json
{"id": "request-id", "error": {"code": "sms_region_unsupported", "message": "SMS is not currently available for this region."}}
```

This is this element's WebSocket-transport analogue of an HTTP 422 on a REST equivalent — same semantic (client error, region not deliverable), carried as a normal envelope-level `error` on this socket rather than an HTTP status. The element renders `error.message` verbatim in the same inline slot as its own client-side notice (overriding the client-side default/override copy) and emits `noizu-auth-sms-region-unsupported` `{pipe, message}`. Reject this **before** any password/OTP verification work so an unsupported region never causes a wasted OTP send or partial account state change.

### Region config endpoint (host-owned, outside this socket)

The element does not fetch the supported-region list itself — the host is responsible for supplying it via the `smsRegions` property (client-side UX only; the check above is what actually enforces it). A typical host exposes a small HTTP config endpoint the *page* (not this element) calls once to populate that property, for example:

```
GET /auth/sms-regions
200 {"supported": ["US", "CA", "GB"], "message": "SMS is not currently available for this region."}
```

`supported` should be the same ISO-3166 alpha-2 vocabulary the element already uses via `<noizu-phone-input>`'s `country`. This endpoint is not part of the `/auth/socket` RPC surface and carries no session state — it is safe to call anonymously, before the socket connects, the same way a host might publish any other public config value. Hosts may instead fold it into an existing public config/feature-flag endpoint; there is no fixed route name.
