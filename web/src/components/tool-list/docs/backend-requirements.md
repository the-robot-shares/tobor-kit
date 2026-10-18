# tobor-tool-list backend requirements

`backend`: **elixir** (reference) / **go** (port). Contract: `openapi/tobor-kit.openapi.yaml`.

The element **does not fetch**. The host (or `<tobor-guide-panel>`) loads
`GET /mcp/tools` and assigns the JSON to the `inventory` property. Clients
render that body verbatim — labels, groups, order, hidden, and `confirm` were
applied server-side (`mcp.allow` / `mcp.deny`, then `mcp.menu`). Do not
re-dress client-side. **`degraded[]` must be shown**; a short list is
information, not an accident.

## Inventory — `GET /api/tobor-kit/mcp/tools`

Session-unscoped: one global inventory for the loaded guide, identical for every caller and session.

| | |
|---|---|
| Method / path | `GET /api/tobor-kit/mcp/tools` |
| Query | `refresh` (boolean, default `false`) — bypass the server inventory cache |
| Request body | none |
| Success | `200` `application/json` `ToolInventory` |

### `200` body

```json
{
  "groups": [{"id": "Github", "label": "Github"}],
  "tools": [
    {"name": "Github.BranchCreate", "label": "New branch", "group": "Github", "read_only": true},
    {"name": "Github.PullCreate", "label": "Open a PR", "group": "Github", "confirm": true}
  ],
  "degraded": [
    {"server": "seo", "label": "SEO", "error": "connection refused"}
  ]
}
```

Required keys: `groups`, `tools`. `degraded` is optional; when present, the UI must show it.

### Errors

| Status | When | Notes |
|---|---|---|
| `401` | Guide `auth.required` and no/invalid bearer | Elixir: `unauthorized`. Go: `unauthorized`. |
| `404` | No guide loaded | Elixir only (`not_found`). |
| `502` | A **required** MCP server was unreachable | Elixir: `mcp_required_down`. Go: `required_server_unreachable`. Optional servers become `degraded[]` instead. |

Pipeline on the server: discover each configured MCP server → apply `mcp.allow` / `mcp.deny` (deny wins) → apply `mcp.menu` (labels, grouping, order, hidden, confirm) → respond.

## Auth

Global contract security is bearer. `GET /guide` stays public; **`GET /mcp/tools` does not** — when `auth.required` is true the host must send `Authorization: Bearer …`.

Token verification is host-owned (Elixir `ToborKit.Endpoint` `current_user` loader; Go auth middleware). **Never** put secrets, API keys, or session cookies on the element. The island has no credentials property.

Anonymous mode (auth not required): requests may proceed without a bearer; Go may still derive a client id from `X-Client-Id`.

## What the component does **not** do

- Call `GET /mcp/tools` itself
- Invoke an MCP tool
- Authorize a tool call
- Send `POST /sessions/{id}/turn` or set `task_id`
- Redirect, `Set-Cookie`, CSRF, or payment
- Re-apply `mcp.menu` or filter allow/deny
- Hide or drop `degraded[]`

`tobor-tool-select` is **advisory**. A host may pass `detail.tool.name` as `task_id` on the next turn (`POST /api/tobor-kit/sessions/{sessionId}/turn`). The contract says that field “names an MCP tool the guide should prefer” and is “not binding — the guide may still decline.” Server-side allow/deny remains the authorization boundary.

## Production vs examples

| Tree | Role |
|---|---|
| `elixir/lib/tobor_kit/components/mcp/` + `elixir/lib/tobor_kit/endpoint.ex` | Reference: live discover → dress → `GET /mcp/tools` |
| `go/internal/mcp/` + `go/internal/server/server.go` `handleMCPTools` | Port of the same contract (fake MCP client for local/tests) |
| `examples/{elixir,go,python,rust}/` | Copy-paste stubs that return canned inventory JSON. They do **not** implement dressing or MCP transport. |

Prefer mounting the production Elixir or Go server. Use the language stubs only when standing up a throwaway host page.
