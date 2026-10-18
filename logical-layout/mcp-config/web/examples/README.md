# tobor-mcp-config examples

Copy the snippet that matches the host. The island emits `config-change`. It
does not persist or validate. Never put secrets in `extras` or on the tag.

Server snippets echo `GET`/`PUT /mcp/config` as an example — not a kit
dependency.

| Start here | Host |
|---|---|
| `html/embed.html` | CDN / import-map page |
| `js/embed.js` | npm + vanilla JS |
| `ts/embed.ts` | npm + TypeScript |
| `elixir/embed.ex` | Phoenix: page + config echo |
| `go/embed.go` | `net/http` (`go run embed.go`) |
| `python/embed.py` | FastAPI (`uvicorn embed:app --port 8000`) |
| `rust/embed.rs` | axum |

Host-owned: URL allowlist, stdio command allowlist, session/bearer.
