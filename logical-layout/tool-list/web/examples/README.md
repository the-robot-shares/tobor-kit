# tobor-tool-list examples

Copy one snippet. The island does not fetch: the host loads `GET /api/tobor-kit/mcp/tools` and assigns `element.inventory`. Listen for `tobor-tool-select`.

| Start here | Host |
|---|---|
| `html/embed.html` | CDN / import-map page |
| `js/embed.js` | npm/vanilla: fetch inventory, set `.inventory`, listen for `tobor-tool-select` |
| `ts/embed.ts` | Same as JS, typed with kit `ToolInventory` |
| `elixir/embed.ex` | Plug stub of `GET /mcp/tools` (Phoenix: `forward` this router) |
| `go/embed.go` | `net/http` stub of the same route |
| `python/embed.py` | FastAPI stub |
| `rust/embed.rs` | axum stub |

Production inventory dressing lives in `elixir/` (reference) and `go/` (port). Language stubs return canned JSON only — they do not talk to MCP servers. `degraded[]` is part of the payload; do not drop it.

If the guide has `auth.required`, the **host** attaches a bearer on the inventory fetch. Never put tokens in markup or these snippets.
