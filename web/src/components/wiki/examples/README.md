# wiki family examples

Serve all three tags: `tobor-wiki-space`, `tobor-wiki-entry`,
`tobor-wiki-entry-editor`. The kit has no wiki API — the host loads and saves.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| Go `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

elixir/go/python/rust stub `GET /wiki/spaces`, `GET /wiki/entries/{id}`,
`PUT /wiki/entries/{id}` so `wiki-save` can echo. That store is a host
example, not a kit contract.

Body is xhtml-first / NPL source text. Do not put secrets on the element.
