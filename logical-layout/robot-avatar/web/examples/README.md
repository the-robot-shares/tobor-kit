# tobor-robot-avatar examples

Copy the snippet that matches the host. Every file mounts `<tobor-robot-avatar>`.
No backend. The **host** sets `state`; the avatar never infers it.

| Start here | Host |
|---|---|
| `html/embed.html` | CDN / import-map page |
| `js/embed.js` | npm + vanilla JS |
| `ts/embed.ts` | npm + TypeScript (kit `ROBOT_STATES`) |
| `elixir/embed.ex` | Phoenix/Plug serving the mount page |
| `go/embed.go` | `net/http` serving the mount page |
| `python/embed.py` | FastAPI serving the mount page |
| `rust/embed.rs` | axum serving the mount page |

`states` and `avatar` are JS properties, not HTML attributes. Host-owned:
drive `state` from your session / SSE `state` event. Never put secrets on this
island.
