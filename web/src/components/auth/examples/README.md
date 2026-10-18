# `noizu-auth` examples

Copy a snippet against the live protocol in [docs/backend-requirements.md](../docs/backend-requirements.md). These are **not** production account services.

| File | Start here when |
|------|-----------------|
| [html/embed.html](html/embed.html) | CDN / import-map page |
| [html/custom-method.html](html/custom-method.html) | Host-owned sign-in (e.g. a device key) in the kit's modal: `custom-method`, `method-*` slots, `complete()` / `fail()`; no backend stub because the element makes no request |
| [elixir/embed.ex](elixir/embed.ex) | Bandit/Plug host — **mounts** `ToborKit.Auth.SocketPlug` and maps `handle_auth/3` onto existing product auth |
| [js/embed.js](js/embed.js) | Node JSON-RPC WebSocket stub |
| [ts/embed.ts](ts/embed.ts) | Typed element mount + JSON-RPC handler stub |
| [go/embed.go](go/embed.go) | `net/http` JSON-RPC WebSocket stub |
| [python/embed.py](python/embed.py) | FastAPI JSON-RPC WebSocket stub |
| [rust/embed.rs](rust/embed.rs) | axum JSON-RPC WebSocket stub |

Production adapter: `elixir/lib/tobor_kit/components/auth/socket.ex`. Do not reimplement it in another language for a kit-hosted product. Stubs never `Set-Cookie` on the socket; HTTP `/auth/session/finish` does. Never put provider secrets in the element or these files.

Every file also documents the **REST transport** (`transport="rest"`, `api-base`): the same element speaking `POST {apiBase}/auth/*` with Bearer-token sessions instead of the auth WebSocket, including the HTTP 409 `merge_required` and HTTP 422 `sms_region_unsupported` mappings. [html/embed.html](html/embed.html) and [ts/embed.ts](ts/embed.ts) carry a runnable REST mount (`mountRestAuth`); the server stubs carry the endpoint/response reference alongside their WebSocket implementation. Cookies are omitted in REST mode by default, and the element never stores the tokens it emits — the host does. Choose the socket transport when the host owns an HttpOnly session cookie; choose REST when the app already exposes `/api/v1/auth/*`.

Each stub also demonstrates the optional SMS-region contract: a `GET /auth/sms-regions` host config route (public, not session-scoped, not part of the `/auth/socket` RPC surface) the page can fetch to populate the element's `smsRegions` property, and a server-side `sms_region_unsupported` rejection on `login`/`register`/`otp-request` when the identifier's region isn't deliverable — authoritative regardless of the client-side allowlist. See [docs/backend-requirements.md](../docs/backend-requirements.md).
