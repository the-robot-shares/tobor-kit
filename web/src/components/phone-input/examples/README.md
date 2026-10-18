# noizu-phone-input examples

No backend. Copy a snippet and mount `<noizu-phone-input>`. `value` is E.164
(`+<dial><national-digits>`). Host-owned: uniqueness / OTP; never put secrets
on the element.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/phone-input'`).

Server languages serve the page. They do not implement a phone API. Echo `phone-change` in page JS if the host wants to persist; uniqueness and OTP stay on the host.
