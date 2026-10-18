# tobor-telemetry-toggle examples

Copy a snippet, point it at a real Guide API, assign `client` (or `consent`).
These are not production servers.

| Start here | When |
|---|---|
| `html/embed.html` | CDN / import-map page, no bundler |
| `js/embed.js` | npm (`@noizu/tobor-kit/telemetry-toggle.js`) vanilla host |
| `ts/embed.ts` | Typed mount + `ToborKitClient` |
| `elixir/embed.ex` | Phoenix/Plug host in front of `ToborKit.Endpoint` |
| `go/embed.go` | `net/http` page in front of `go/internal/server` |
| `python/embed.py` | FastAPI page; reverse-proxy `/api/tobor-kit` to Elixir/Go |
| `rust/embed.rs` | axum page; same proxy |

`client` and `consent` are **property-only**. The element calls
`GET`/`PUT /api/tobor-kit/telemetry/consent` (see
`docs/backend-requirements.md`). Listen for `tobor-telemetry-change`. When
`source` is `forced` or `user_overridable` is false — including after a `403`
— the element renders nothing.

CDN build (`https://cdn.derobot.is/tobor-kit/latest/components/telemetry-toggle/telemetry-toggle.js`)
rewrites `lit` to relative `vendor/`; no import map required for that file.
npm: `import '@noizu/tobor-kit/telemetry-toggle.js'` (peer `lit`).
