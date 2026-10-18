# noizu-footer-brand examples

Copy the snippet that matches the host. Every file mounts
`<noizu-footer-brand>` with a couple of attribute variations. No backend, no
events — the whole API is attributes + CSS custom properties.

| Start here | Host |
|---|---|
| `html/embed.html` | CDN / import-map page |
| `js/embed.js` | npm + vanilla JS |
| `ts/embed.ts` | npm + TypeScript |
| `elixir/embed.ex` | Phoenix/Plug serving the mount page |
| `go/embed.go` | `net/http` serving the mount page |
| `python/embed.py` | FastAPI serving the mount page |
| `rust/embed.rs` | axum serving the mount page |

Host-owned: the link destination (`href`) and any analytics around it. Never
put secrets on this island — there is nothing to put them on.
