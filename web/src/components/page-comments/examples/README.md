# Examples — `<noizu-page-comments>`

Copy one snippet and mount the island.

| Host | Start here |
|---|---|
| CDN / static HTML | `html/embed.html` — **full demo**: MemoryDataSource + dynamic content, no backend needed |
| npm (JavaScript) | `js/embed.js` |
| npm (TypeScript) | `ts/embed.ts` |
| Plug / Phoenix / Hologram | `elixir/embed.ex` |
| Go `net/http` | `go/embed.go` |
| FastAPI | `python/embed.py` |
| axum | `rust/embed.rs` |

`html/embed.html` is the reference demo: it injects `MemoryDataSource` with a
seeded thread, appends paragraphs at runtime (anchors re-resolve; the rail
re-lays-out), and needs no service. The other examples point
`HttpDataSource` at the annotate contract documented in
`docs/backend-requirements.md` (the elixir/go/python/rust files serve a
minimal dev stub of the *read* side only — none of them implement the
production service).

Auth is popup-based (`{api-base}/embed/login?site=…&origin=…` →
`postMessage` handback). The widget holds tokens in memory; never paste a
bearer secret into markup or an attribute.
