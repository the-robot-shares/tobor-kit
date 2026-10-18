# noizu-billing-status examples

No kit backend. Copy a snippet, set `.subscription` from the **host** snapshot, listen for `portal-open`. The island never talks to Stripe.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix / Plug | [elixir/embed.ex](elixir/embed.ex) |
| `net/http` | [go/embed.go](go/embed.go) |
| FastAPI | [python/embed.py](python/embed.py) |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/billing-status'`).

elixir/go/python/rust serve the page and stub `POST /billing/portal` → `{url}`. Production hosts create a Stripe Billing Portal session **on the server**. Never put `sk_…` or webhook secrets on the element.

Contract: [../docs/backend-requirements.md](../docs/backend-requirements.md).
