# asset family examples

Serve both tags: `tobor-asset-view` and `tobor-asset-editor`. No kit backend. Copy a snippet, set `.asset` from the **host** store, listen for `asset-save` (and optionally `asset-open`). The islands never persist.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/asset-view.js'`).

elixir/go/python/rust serve the page and stub `GET`/`PUT /assets/:id`. Production hosts own blob storage and auth. Never put secrets on the element.

Contract: [../docs/backend-requirements.md](../docs/backend-requirements.md).
