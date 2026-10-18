# tobor-mode-toggle examples

Copy the snippet that matches the host. Every file mounts `<tobor-mode-toggle>`
and listens for `tobor-mode-change` `{mode, previous}`. No backend.

| Start here | Host |
|---|---|
| `html/embed.html` | CDN / import-map page |
| `js/embed.js` | npm + vanilla JS |
| `ts/embed.ts` | npm + TypeScript (kit `GuideMode` types) |
| `elixir/embed.ex` | Phoenix/Plug serving the mount page |
| `go/embed.go` | `net/http` serving the mount page |
| `python/embed.py` | FastAPI serving the mount page |
| `rust/embed.rs` | axum serving the mount page |

`modes` is a JS property, not an HTML attribute — set it after the element is
in the document. Host-owned: optional persistence of the last mode. Never put
secrets on this island.
