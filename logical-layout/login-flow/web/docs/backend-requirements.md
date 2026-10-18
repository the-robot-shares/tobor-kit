# tobor-login-flow — backend requirements

`backend: elixir`. The island is a public OIDC Authorization Code + PKCE client. The **host** owns the token exchange that establishes a session, the redirect URI, and HttpOnly cookies. The element **never** holds a client secret, never `Set-Cookie`, and never performs CSRF or payment.

Ops registration (Authentik application, Infisical, env keys): [docs/authentik-oidc-registration.md](../../../../../docs/authentik-oidc-registration.md).

## Public config the host injects

From `GET /api/tobor-kit/guide` → `auth`, or equivalent env. Set as the element's `.auth` property (not an HTML attribute).

| Field | Required | Default | Notes |
|---|---|---|---|
| `issuer` | yes (when login is on) | — | Trailing slash is stripped before any URL is built. Authentik per-provider issuers (`…/application/o/<slug>/`) 404 discovery otherwise. |
| `client_id` | yes | — | **Public** client id. Not a secret. |
| `scopes` | no | `openid email profile` | Space-joined on the authorize URL. |
| `redirect_path` | no | `/auth/oidc/callback` | Host-owned path, registered at the IdP as the redirect URI. |
| `provider` | no | `oidc` | `authentik` selects the slash-stripped issuer profile; `none` disables the island. |
| `required` | no | — | `false` hides the island (anonymous guide). |

Environment (Elixir runtime, `config :tobor_kit, ToborKit.Auth.OIDC`):

| Env | Maps to |
|---|---|
| `TOBOR_KIT_OIDC_ISSUER` | `issuer` |
| `TOBOR_KIT_OIDC_CLIENT_ID` | `client_id` |
| `TOBOR_KIT_OIDC_REDIRECT_URI` | absolute redirect URI for the **server** flow (`redirect_path` resolved against the host origin) |

Never put `client_secret`, Infisical tokens, or session cookies in attributes, examples, or the element.

## What the Guide API does **not** expose

`openapi/tobor-kit.openapi.yaml` defines **no** `/auth` routes. Login is client-initiated against the issuer advertised on `GET /guide`. After login, Guide API calls send `Authorization: Bearer <access_token>`. The server treats the bearer as opaque (`ToborKit.Endpoint.AuthPlug`); `/guide` and `/healthz` stay public.

## Host-owned HTTP surface

These routes live on the **product host**, not inside the Guide API. Examples call these paths; they do not reimplement `ToborKit.Auth.OIDC`.

### `GET {redirect_path}` (default `/auth/oidc/callback`)

OAuth redirect URI. Query: `code`, `state` (and provider extras).

**Host must:**

1. Complete the code exchange **on the server** (`ToborKit.Auth.OIDC.callback/3` or Go `auth.Exchange`).
2. Verify the id token (JWKS, `iss`, `aud`, `exp`, nonce) — Elixir does this; do not skip it in production.
3. `Set-Cookie` an HttpOnly, Secure, SameSite session. Rotate/renew the session.
4. `302` to the app **without** `code` in the URL.

Do **not** render `<tobor-login-flow>` on this response while `?code=` is still in the address bar (the element would also try `completeLogin`). If the callback page must mount the island, set `callback-search=""`.

### `POST /auth/session` (optional, public-PKCE path)

When the element (or `completeLogin`) emits `tobor-auth-token`, the host may accept `{id_token}` (and optionally `access_token`), verify JWKS, and set the same cookie. Same-origin, credentials included. Never accept a client secret from the browser.

Request: `Content-Type: application/json`, body `{id_token: string}`.
Response: `204` + `Set-Cookie`, or `401` if verification fails.

### `GET /auth/oidc` (optional, host-owned start)

When the **host** holds the PKCE verifier (server session), start with `ToborKit.Auth.OIDC.authorization_url/2` and `302` to the IdP. Do not mix this verifier with the element's `sessionStorage` verifier — they are different flows.

## IdP endpoints (public PKCE)

Issuer is slash-normalized first (`normalizeIssuer` / `ToborKit.Auth.OIDC.normalize_issuer/1`).

| Method | Path | Notes |
|---|---|---|
| `GET` | `{issuer}/.well-known/openid-configuration` | Discovery. Elixir/Go use `authorization_endpoint` + `token_endpoint` from this document. The Lit helpers currently call `{issuer}/authorize` and `{issuer}/token` directly. |
| `GET` | `{authorization_endpoint}` | Query: `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256` (Elixir also sends `nonce`). |
| `POST` | `{token_endpoint}` | `Content-Type: application/x-www-form-urlencoded`. Body: `grant_type=authorization_code`, `client_id`, `redirect_uri`, `code`, `code_verifier`. **No `client_secret`.** |

Success token JSON includes `access_token` and typically `id_token`. Non-2xx is a failed exchange.

## Elixir / Go library (production trees)

| Tree | Module | Role |
|---|---|---|
| `elixir/lib/tobor_kit/components/auth/oidc.ex` | `ToborKit.Auth.OIDC` | Reference: discovery, authorize URL, callback, JWKS id-token verify. Session is an explicit map; `state` is cleared **before** the token POST. |
| `elixir/lib/tobor_kit/components/auth/auth_plug.ex` | `ToborKit.Endpoint.AuthPlug` | Bearer gate for the Guide API after login. |
| `go/internal/auth/pkce.go` | `auth` | Same PKCE + discovery + exchange. Importable only from a binary in the Go module (`internal/`). |

`ToborKit.Auth.OIDC.callback/3` error atoms (host maps these to 4xx, never leaks internals): `:state_mismatch`, `:oidc_not_configured`, `:discovery_failed`, `:token_exchange_failed`, `:issuer_mismatch`, `:aud_mismatch`, `:token_expired`, `:nonce_mismatch`, `:signature_invalid`, `:malformed_id_token`, `:unknown_signing_key`.

## What the component does **not** do

- Client secret, confidential-client token requests
- `Set-Cookie` / session rotation / CSRF
- Server-side id-token signature verification (that is Elixir/Go)
- Guide API `/auth/*` (there are none)
- Payment, account store, provider admin registration

Examples under `examples/` are copy-paste hosts that **call** these routes and `ToborKit.Auth.OIDC`. They are not the production server.
