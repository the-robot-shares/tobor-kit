# npl-view family examples

Serve `tobor-npl-view`. No kit backend is required. The host sets the `source`
string and may listen for `npl-copy`.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix | [elixir/embed.ex](elixir/embed.ex) |
| Go `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

elixir/go/python/rust only serve the page. Those hosts are stubs, not a kit API.

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to
`vendor/` — no import map. npm installs keep `lit` as a peer
(`import '@noizu/tobor-kit/npl-view.js'`).

Do not put secrets on the element.
