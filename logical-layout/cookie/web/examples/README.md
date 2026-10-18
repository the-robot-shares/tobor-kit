# cookie family examples

Serve both tags: `noizu-cookie-consent` and `noizu-cookie-settings`. No backend is required.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix | [elixir/embed.ex](elixir/embed.ex) |
| Go `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

elixir/go/python/rust optionally echo `POST /consent` when the host wants to persist `cookie-consent-change` / `start-app:cookie-consent-change`. That route is a stub, not a kit API.

Default `storage-key`: `start-app.cookie-consent.v1`. Do not put secrets on the element.
