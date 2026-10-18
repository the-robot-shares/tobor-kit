# styleguide family examples

No kit backend. Copy a snippet and mount the atoms. Listen for `sg-click` / `sg-card-select` / `sg-input`; the host owns navigation and persistence.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/sg-btn'`).

elixir/go/python/rust serve the page. They do not implement an API. Never put secrets on the elements.

`rows` (`noizu-sg-spec-table`) and `steps` (`noizu-sg-steps`) are JS properties, not HTML attributes.

Contract: [../docs/backend-requirements.md](../docs/backend-requirements.md).
