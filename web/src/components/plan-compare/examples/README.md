# noizu-plan-compare examples

Copy the snippet that matches the host. Every file mounts `<noizu-plan-compare>` with sample plans (property or JSON script) and listens for `plan-select` `{planId, checkoutUrl, interval}`.

No backend. elixir/go/python/rust **serve the page** with sample plans JSON. They do not create Stripe sessions.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix | [elixir/embed.ex](elixir/embed.ex) |
| Go `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

`plans` is a JS property (or a child JSON script), not an HTML attribute. `checkout-url-template` interpolates `{planId}` — point it at host-owned Payment Links. Never put Stripe keys on the element. Host-owned: navigate on `plan-select`.
