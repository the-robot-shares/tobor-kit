# noizu-model-config examples

Copy the snippet that matches the host. The island emits `model-change`,
`custom-endpoint-save`, and `budget-change`. It does not persist.

`catalog` is a JS property. Server snippets set `catalog-url="/api/v1/ai/models"`
and echo TRK-shaped `GET`/`PATCH /api/v1/ai/settings` as an example — not a kit
dependency. Empty `apiKey` on save means keep stored. **Never log the key.**

| Start here | Host |
|---|---|
| `html/embed.html` | CDN / import-map page (in-memory catalog) |
| `js/embed.js` | npm + vanilla JS |
| `ts/embed.ts` | npm + TypeScript |
| `elixir/embed.ex` | Phoenix: page + catalog + settings echo |
| `go/embed.go` | `net/http` (`go run embed.go`) |
| `python/embed.py` | FastAPI (`uvicorn embed:app --port 8000`) |
| `rust/embed.rs` | axum |

Host-owned: session/bearer, nearest-ancestor inherit, mapping `budget` to cents.
Never put provider API keys on the tag.
