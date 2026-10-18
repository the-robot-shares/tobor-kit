# Tool list (Hologram mirror)

Port of `web/src/components/tool-list/tool-list.ts` (Lit) →
`ToborKit.Hologram.ToolList.List`.

## Usage

```elixir
<List cid="my-tool-list" inventory={@tool_inventory} show_descriptions={true} target="page" />
```

`cid` is required. `target` is the host that receives the selection action.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `inventory` | string-keyed map (`groups`/`tools`/`degraded`) | `Data.Tools.empty_inventory()` | groups derived via `Data.Tools.group_tools/2` in `init/3` |
| `show_descriptions` | boolean | `false` | toggles per-tool description lines |
| `target` | string | `"parent"` | action dispatch target |

## Event contract

| Lit `CustomEvent` | Hologram action | Params |
|---|---|---|
| `tobor-tool-select` | `tobor_tool_select` (direct action binding) | `%{tool: tool}` |

Item clicks bind the host action directly (`$click={action: :tobor_tool_select, ...,
target: @target}`) — no internal interception, unlike the task menu.

## Theming

Scoped under `.tk-tool-list` (groups, labels, warning badges for confirm
tools, degraded-servers notice, empty state). Shared `.tk-*` tokens only.

## data-cy

`web/registry.yaml` declares `cy_prefix: tools` but **no `cy:` hooks**. The
mirror copies the Lit source's `data-testid` attributes verbatim instead:
`tools-unavailable`, `degraded-servers`, `degraded-unidentified`,
`tools-empty`.

## Divergences

- `data-testid` instead of `data-cy` (registry declares none — see above).
- Degraded-server entries without a `server` name render under
  `degraded-unidentified` (registry parity).

## Backend

None. Host owns tool invocation — the mirror only reports the selection.
