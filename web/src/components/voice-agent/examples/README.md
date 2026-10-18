# tobor-voice-agent examples

Copy a snippet and point `backend-url` at a voice gateway. Production code lives in repository `backend/` (Node). These files are host mounts, not that service.

| Start here | Host |
|------------|------|
| `html/embed.html` | CDN / import-map page |
| `js/embed.js` | npm + vanilla JS |
| `ts/embed.ts` | npm + typed mount |
| `elixir/embed.ex` | Phoenix/Plug: render the tag; proxy or stub `POST /voice/sessions` |
| `go/embed.go` | `net/http` page + reverse-proxy `/voice/` to the Node gateway |
| `python/embed.py` | FastAPI page + stub session/WS (or proxy) |
| `rust/embed.rs` | axum page + stub session/WS (or proxy) |

Local playground (real fixture gateway, not these stubs): `npm --prefix backend run test:debug` then `npm --prefix web run demo:voice`. See `web/VOICE-TESTING.md`.

Never put provider API keys, MCP credentials, or session cookies in markup. `backend` is a policy name; `backend-url` is this application's gateway.
