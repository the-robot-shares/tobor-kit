# noizu-waitlist examples

Copy a snippet and mount `<noizu-waitlist>`. Production API default: `https://foryou.therobotlives.com`.

The island calls:

- `GET {api}/api/v1/public/lists/{slug}`
- `POST {api}/api/v1/public/lists/{slug}/signups`
- `GET {api}/api/v1/public/services/{service}/lists/{list}`
- `POST {api}/api/v1/public/services/{service}/lists/{list}/signups`

POST JSON `{values, source, company_website}`. Honeypot `company_website`: persist nothing when nonempty, still **202**. `credentials: 'omit'`. No secrets on the element.

| Host | Start here |
|---|---|
| CDN / static HTML (hits ForYou) | [html/embed.html](html/embed.html) |
| npm + vanilla JS | [js/embed.js](js/embed.js) |
| npm + TypeScript | [ts/embed.ts](ts/embed.ts) |
| Phoenix | [elixir/embed.ex](elixir/embed.ex) — page + GET/POST handlers |
| Go `net/http` | [go/embed.go](go/embed.go) — `go run embed.go` |
| FastAPI | [python/embed.py](python/embed.py) — `uvicorn embed:app --port 8000` |
| axum | [rust/embed.rs](rust/embed.rs) |

CDN artifacts (`https://cdn.derobot.is/tobor-kit/latest/…`) rewrite Lit to `vendor/` — no import map. npm installs keep `lit` as a peer (`import '@noizu/tobor-kit/waitlist'`).

Server snippets set `el.api = location.origin` so the island talks to **this** process. Omit `api` (or set it to `https://foryou.therobotlives.com`) to use production ForYou lists instead.
