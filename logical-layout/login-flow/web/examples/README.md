# tobor-login-flow examples

Copy one snippet. Public config only — never a client secret or session cookie.

| Host | Start here |
|---|---|
| CDN / import-map page | [html/embed.html](./html/embed.html) |
| npm, vanilla JS | [js/embed.js](./js/embed.js) |
| TypeScript (kit types) | [ts/embed.ts](./ts/embed.ts) |
| Phoenix / Plug (reference backend) | [elixir/embed.ex](./elixir/embed.ex) |
| Go `net/http` | [go/embed.go](./go/embed.go) |
| FastAPI | [python/embed.py](./python/embed.py) |
| axum | [rust/embed.rs](./rust/embed.rs) |

- **Element / public PKCE:** html, js, ts — set `.auth`, listen for `tobor-auth-redirect` / `tobor-auth-token` / `tobor-auth-error`. POST `id_token` to the host `/auth/session` so the host owns the cookie.
- **Host-owned token + cookie:** elixir (calls `ToborKit.Auth.OIDC`), go / python / rust — serve the page, own `GET /auth/oidc/callback` (and optional `GET /auth/oidc` start). `302` off the callback **before** rendering the island with `?code=` still in the URL.

Routes and payloads: [../docs/backend-requirements.md](../docs/backend-requirements.md).
