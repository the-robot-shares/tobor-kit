# noizu-subscription-gate examples

Copy a snippet and mount `<noizu-subscription-gate>`. **None required** for a backend: set `entitled` from the host session. Optional `GET {check-url}` (`200` + `{entitled: true}`).

The island does not take payment, set cookies, or send secrets. `auto-redirect` defaults to false — listen for cancelable `gate-blocked` `{redirectTo}` and navigate in the host.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix | [elixir/embed.ex](elixir/embed.ex) — page + optional `GET /entitlement` |
| Go `net/http` | [go/embed.go](go/embed.go) — `go run embed.go` |
| FastAPI | [python/embed.py](python/embed.py) — `uvicorn embed:app --port 8000` |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/subscription-gate'`).

Server snippets implement `GET /entitlement` as a stub (`{"entitled": true}`). Replace with a session/billing lookup. Never put secrets on the element.
