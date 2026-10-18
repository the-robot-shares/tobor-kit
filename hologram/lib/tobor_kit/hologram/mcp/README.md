# MCP family (Hologram mirrors)

Ports of the Lit `mcp-clients` / `mcp-domain` components:

- `web/src/components/mcp-clients/tobor-mcp-clients.ts` → `ToborKit.Hologram.Mcp.Clients`
- `web/src/components/mcp-domain/tobor-mcp-domain.ts` → `ToborKit.Hologram.Mcp.Domain`

## Usage

```elixir
<Clients cid="my-clients" clients={@clients} target="page" />

<Domain
  cid="my-domain"
  tools={@domain_tools}
  inventory={@tool_inventory}
  preview_cid="my-domain-preview"
  target="page"
/>
```

`cid` is required on both. `Domain` additionally needs a distinct
`preview_cid` for the composed `ToolList.List` preview instance.

## Props

### Clients

| Prop | Type | Default |
|---|---|---|
| `clients` | list of string-keyed maps (`id`/`name`/`status`/`auth`) | `[]` |
| `target` | string | `"parent"` |

`auth` clamps to the registry union `oauth | api-key`; `status` is displayed
verbatim with a derived `data-kind` (`connected`, `authorization_failed`, …)
computed server-side in `init/3` (Lit does `toLowerCase + \s+ → _` regex).

### Domain

| Prop | Type | Default |
|---|---|---|
| `tools` | list of `{name, visibility}` maps | `[]` |
| `inventory` | tool inventory map | `nil` (synthetic single-group preview) |
| `preview_cid` | string | required for the preview |
| `target` | string | `"parent"` |

`visibility` clamps to the tri-state union `visible | discoverable | disabled`.

## Event contract

| Lit `CustomEvent` | Hologram action | Params |
|---|---|---|
| `client-authorize` | `:client_authorize` | `%{id}` |
| `client-revoke` | `:client_revoke` | `%{id}` |
| `tool-visibility-change` | `:tool_visibility_change` | `%{name, visibility}` |

The mirrors never navigate; authorization/revocation is entirely host-owned.

## Theming

`.tk-mcp-clients__*` (roster rows, status colors keyed off `data-kind`) and
`.tk-mcp-domain__*` (tool rows, monospace names, tri-state selects, preview
label). Shared `.tk-*` tokens only.

## data-cy

| Tag | Hooks |
|---|---|
| mcp-clients | `mcp.clients`, `mcp.authorize`, `mcp.revoke` |
| mcp-domain | `mcp.domain`, `mcp.tool` |

## Divergences

- Domain select ids (`vis-<sanitized name>`) are computed server-side in
  `init/3` (Lit regex runs client-side).
- The preview `ToolList.List` is a real composed Hologram component bound to
  `preview_cid`; visibility changes recompute its inventory server-side and
  the preview's item clicks forward `tobor-tool-select` to the Domain's
  `target` (Lit swallows them). Hosts embedding multiple `Domain` instances
  on one page must give each a distinct `preview_cid`.

## Backend

None. Host owns authorization, revocation and visibility persistence — the
mirrors only report intent (`:client_authorize`, `:client_revoke`,
`:tool_visibility_change`).
