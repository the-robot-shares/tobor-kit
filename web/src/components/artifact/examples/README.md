# artifact family examples

Serve both tags: `tobor-artifact-view` and `tobor-artifact-editor`. No kit
backend is required. The host sets the `artifact` JS property and persists
`artifact-save` / handles `review-start`.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix | [elixir/embed.ex](elixir/embed.ex) |
| Go `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

elixir/go/python/rust optionally echo `GET`/`PUT /artifacts/{id}` and
`POST /reviews`. Those routes are stubs, not a kit API.

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to
`vendor/` — no import map. npm installs keep `lit` as a peer
(`import '@noizu/tobor-kit/artifact-view.js'`).

`artifact` is a JS property. Do not put secrets on the element.
