# Examples

Copy one snippet and mount `<tobor-guide-panel>` against a real Guide API.

| Host | Start here |
|---|---|
| CDN / static HTML | `html/embed.html` |
| npm (JavaScript) | `js/embed.js` |
| npm (TypeScript) | `ts/embed.ts` |
| Plug / Phoenix / Hologram | `elixir/embed.ex` |
| Go `net/http` | `go/embed.go` |
| FastAPI | `python/embed.py` |
| axum | `rust/embed.rs` |

The panel fetches `GET /api/tobor-kit/guide` (config projection only — no NPL
preamble) then sessions, SSE turns, tools, voice, telemetry, and transcript.
Those routes are implemented in `elixir/` (reference) and `go/` (port). These
files call them; they do not reimplement the service.

Hosts own the bearer token; never put a secret on the tag.
