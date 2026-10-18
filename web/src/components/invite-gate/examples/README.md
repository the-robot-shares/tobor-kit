# noizu-invite-gate examples

Copy a snippet, serve it at the interstitial route (`/auth/invite-required`), and mount
`<noizu-invite-gate>`. **Backend required:** `POST /api/v1/invites/redeem {"token"}`
(see [../docs/backend-requirements.md](../docs/backend-requirements.md)). The server
snippets stub it: `GOOD-INVITE` redeems, `USED-INVITE` answers 409, anything else 404.
Replace the stub with the real redeem (email-bound lookup, consume, membership, flip
`pending` → `active`, all in one transaction) and keep it rate-limited.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) — also the global 403 helper |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) — Bearer token + `withInviteGate` |
| Phoenix | [elixir/embed.ex](elixir/embed.ex) |
| Go `net/http` | [go/embed.go](go/embed.go) — `go run embed.go` |
| FastAPI | [python/embed.py](python/embed.py) — `uvicorn embed:app --port 8000` |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no
import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/invite-gate'`;
the element-free helpers are `@noizu/tobor-kit/invite-required`).
