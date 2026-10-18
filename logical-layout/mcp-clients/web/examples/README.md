# tobor-mcp-clients examples

Copy the snippet that matches the host. The island emits `client-authorize`
and `client-revoke`. **OAuth redirect is host-owned** — the element never
assigns `location`. Never put API keys or client secrets on the tag.

Server snippets echo `GET /mcp/clients` and `POST …/authorize|revoke` as an
example — not a kit dependency. Stubs do not redirect.

| Start here | Host |
|---|---|
| `html/embed.html` | CDN / import-map page |
| `js/embed.js` | npm + vanilla JS |
| `ts/embed.ts` | npm + TypeScript |
| `elixir/embed.ex` | Phoenix: page + clients echo |
| `go/embed.go` | `net/http` (`go run embed.go`) |
| `python/embed.py` | FastAPI (`uvicorn embed:app --port 8000`) |
| `rust/embed.rs` | axum |
