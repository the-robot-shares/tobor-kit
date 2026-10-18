# tobor-mcp-domain examples

Copy the snippet that matches the host. The island emits
`tool-visibility-change`. It does not persist.

`tools` (and optional `inventory`) are JS properties. Server snippets echo
`GET`/`PATCH /mcp/domain` as an example — not a kit dependency.

| Start here | Host |
|---|---|
| `html/embed.html` | CDN / import-map page |
| `js/embed.js` | npm + vanilla JS |
| `ts/embed.ts` | npm + TypeScript |
| `elixir/embed.ex` | Phoenix: page + domain echo |
| `go/embed.go` | `net/http` (`go run embed.go`) |
| `python/embed.py` | FastAPI (`uvicorn embed:app --port 8000`) |
| `rust/embed.rs` | axum |

Host-owned: session/bearer, mapping visibility onto allow/deny. Never put MCP
credentials on the tag.
