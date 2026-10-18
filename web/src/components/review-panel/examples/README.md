# tobor-review-panel examples

No kit backend. Copy a snippet, set `.reviews` from the **host** snapshot, listen for `review-submit` / `review-resolve`. The island never fetches.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/review-panel.js'`).

elixir/go/python/rust serve the page and stub host routes:

- `GET /artifacts/{id}/reviews`
- `POST /artifacts/{id}/reviews` `{body}`
- `POST /artifacts/{id}/reviews/{id}/resolve`

Production hosts persist on the **server**. Never put API keys or session cookies on the element.

Contract: [../docs/backend-requirements.md](../docs/backend-requirements.md).
