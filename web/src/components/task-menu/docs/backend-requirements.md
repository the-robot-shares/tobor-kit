# tobor-task-menu backend requirements

`backend: elixir` (reference). Go is a port of the same OpenAPI contract.
Configurator label is `elixir`; both trees implement `GET /mcp/tools`.

The island **does not fetch**. The host (or `<tobor-guide-panel>` via
`ToborKitClient.listTools()`) loads the inventory and assigns the
property-only `inventory`. Production dressing lives in `elixir/` and `go/`,
not in `examples/` (those stubs return canned JSON only).

Contract: `openapi/tobor-kit.openapi.yaml` — `operationId: listTools`.
Mount: `/api/tobor-kit`.

## Endpoints

### `GET /api/tobor-kit/mcp/tools`

Live MCP inventory, session-unscoped (same payload for every caller).

Pipeline (server-side; do not repeat in the browser):

1. Discover tools from every configured MCP server.
2. Apply guide `mcp.allow` / `mcp.deny` globs (deny wins).
3. Apply `mcp.menu` overlay (labels, groups, order, hidden, confirm).

| | |
|---|---|
| Query | `refresh` (boolean, default `false`) — bypass the inventory cache |
| Request body | none |

**200** `application/json`

```json
{
  "groups": [{"id": "Github", "label": "Github"}],
  "tools": [
    {
      "name": "Github.BranchCreate",
      "label": "New branch",
      "group": "Github"
    },
    {
      "name": "Github.PullCreate",
      "label": "Open a PR",
      "group": "Github",
      "confirm": true
    }
  ],
  "degraded": [
    {"server": "tickets", "label": "Tickets", "error": "timeout"}
  ]
}
```

`groups` and `tools` are required. `degraded` is optional; treat missing as
`[]`. Each degraded item may include `server`, `label`, `error`. The island
renders generic copy when `server` is absent.

**401** `{ "code": "unauthorized", "message": "…" }` — missing/invalid bearer
when `auth.required` is true. (`GET /guide` stays public; this route does not.)

**502** — a **required** MCP server was unreachable. Body is an `Error`
(`code` + `message`). Elixir uses `mcp_required_down`; Go uses
`required_server_unreachable`. Required-down is **not** a `degraded[]` entry.

Elixir also answers **404** `{ "code": "not_found" }` when no guide is loaded.

## Auth

- Scheme: `Authorization: Bearer <access-token>` (OIDC access token from the
  guide's advertised issuer). Opaque to this API — no introspection, no refresh.
- When `auth.required` is false, unauthenticated callers are allowed.
- **Never** put provider keys, client secrets, or session cookies on the
  element. Token plumbing is host-owned (`ToborKitClient` `token` option).

## Advisory, not authorization

`tobor-task-select` is a UI event. The island does not invoke MCP tools and
does not grant permission to run them. Inline confirm for `confirm: true` is
UX, not an access-control gate.

A host may pass `detail.tool.name` as `task_id` on
`POST /api/tobor-kit/sessions/{sessionId}/turn`. The contract says that field
“names an MCP tool the guide should prefer” and is **not binding** — the guide
may still decline. Server-side allow/deny remains the authorization boundary.

## What the component does not do

- HTTP, redirects, `Set-Cookie`, CSRF, payment
- Allow/deny globs or `mcp.menu` overlay (already applied)
- Hide or drop `degraded[]`
- Invoke tools or start a turn (`tobor-task-select` is advisory)
- Authorize a tool call (confirm is not authz)
- Handle 401/502 (host decides; leaving `inventory` unset shows "No tasks available.")

## Production vs examples

| Tree | Implementation |
|---|---|
| `elixir/lib/tobor_kit/components/mcp/` | Reference: `ToborKit.MCP.inventory/2`; route `GET /api/tobor-kit/mcp/tools` on `ToborKit.Endpoint` |
| `go/internal/mcp/` + `go/internal/server/` | Port: `mcp.Builder.Build`; `handleMCPTools` |
| `examples/{elixir,go,python,rust}/` | Throwaway **stubs** of `GET /mcp/tools` JSON — they do not dress or talk to MCP |
| `examples/{html,js,ts}/` | Host mount snippets that fetch that route and set `.inventory` |

Swift UI is out of this family folder; it consumes the same JSON.
