# prompt family examples

Serve both tags: `tobor-prompt-library`, `tobor-prompt-history`. The kit has
no prompt API — the host loads and persists stars/forks.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| Go `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

elixir/go/python/rust stub `GET /prompts`, `PUT /prompts/{id}/star`,
`GET /prompts/history`, `POST /prompts/{id}/fork` so star/fork can echo.
That store is a host example, not a kit contract.

Bodies are source text. Do not put secrets on the element.
