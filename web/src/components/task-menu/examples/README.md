# tobor-task-menu examples

Copy a snippet. The island does not fetch: the host loads
`GET /api/tobor-kit/mcp/tools` and assigns `inventory`. These are not
production servers.

| Start here | When |
|---|---|
| `html/embed.html` | CDN / import-map page, no bundler |
| `js/embed.js` | npm (`@noizu/tobor-kit/task-menu.js`) vanilla host; sets `.inventory` |
| `ts/embed.ts` | Typed mount + `ToborKitClient.listTools()`; sets `.inventory` |
| `elixir/embed.ex` | Plug stub of `GET /mcp/tools` JSON (or `forward` to `ToborKit.Endpoint`) |
| `go/embed.go` | `net/http` stub of the same JSON route |
| `python/embed.py` | FastAPI stub of the same JSON route |
| `rust/embed.rs` | axum stub of the same JSON route |

Inventory is **property-only**. Fetch `GET /api/tobor-kit/mcp/tools` (see
`docs/backend-requirements.md`) and set `el.inventory`. Listen for
`tobor-task-select`. Do not re-dress tools or drop `degraded[]`.

Language stubs return canned JSON only. Prefer mounting production `elixir/`
or `go/` when you have a guide bundle.

If the guide has `auth.required`, the **host** attaches a bearer on the
inventory fetch. Never put tokens in markup.
