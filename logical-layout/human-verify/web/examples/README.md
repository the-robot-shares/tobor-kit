# noizu-human-verify examples

Copy a snippet and mount `<noizu-human-verify>`. The island emits `verified`; it never siteverifies.

The host MUST:

- Keep Turnstile / reCAPTCHA **secrets** in server env (`TURNSTILE_SECRET`, `RECAPTCHA_SECRET`)
- POST `verified.detail.token` to siteverify (see [../docs/backend-requirements.md](../docs/backend-requirements.md))
- Put only the **public** site key on `site-key`

Snippets default to `provider="none"` so they run without keys. Switch to `turnstile` or `recaptcha-v3` and set the public site key when you have one.

| Host | Start here |
|---|---|
| CDN / static HTML | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix | [elixir/embed.ex](elixir/embed.ex) — page + `POST /verify` |
| Go `net/http` | [go/embed.go](go/embed.go) — `go run embed.go` |
| FastAPI | [python/embed.py](python/embed.py) — `uvicorn embed:app --port 8000` |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/human-verify'`).

Server snippets listen for `verified` and `POST /verify` on **this** origin, which then calls Cloudflare or Google siteverify. Do not call siteverify from the browser.
