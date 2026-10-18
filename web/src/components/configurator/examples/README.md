# tobor-configurator examples

No backend. Copy a snippet and mount `<tobor-configurator>` with a schema (JSON script, `.schema` property, or `schema-src`).

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer.

`schema` is a JS property, not an HTML attribute. Server languages serve the page. They do not implement a configurator API. Host-owned: insert markup on `configurator-apply`; never put secrets on the element.
