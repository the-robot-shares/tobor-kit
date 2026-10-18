# Examples

Copy one snippet and mount `<tobor-chat-thread>` against a real Guide API.

| Host | Start here |
|---|---|
| CDN / static HTML | `html/embed.html` |
| npm (JavaScript) | `js/embed.js` |
| npm (TypeScript) | `ts/embed.ts` |
| Plug / Phoenix / Hologram | `elixir/embed.ex` |
| Go `net/http` | `go/embed.go` |
| FastAPI | `python/embed.py` |
| axum | `rust/embed.rs` |

Optional transcript is `GET`/`DELETE /api/tobor-kit/sessions/{sessionId}/transcript`
on the Elixir or Go backend. These files do not reimplement that service.

A **501** means the guide uses a client store (`memory` / `local`). Set
`load = {status: "not_server_backed"}` — that is not empty and not an error.

`thread-send` is events-up. Hosts that persist must `POST /sessions/{id}/turn`
themselves; never put a bearer secret on the tag.

`?session=<uuid>` uses `createBackendStore`. Without it, snippets use
`createMemoryStore` so the island still renders.
