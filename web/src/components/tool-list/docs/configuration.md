# tobor-tool-list configuration

Tags in this family: **`tobor-tool-list`**.

Browsable list of server-dressed MCP tools. The host assigns `inventory` from
`GET /mcp/tools`; the element renders that payload **verbatim** and never
re-applies the `mcp.menu` overlay. Clicking a row fires **`tobor-tool-select`**
— it does **not** invoke the tool.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `inventory` | `ToolInventory \| null` | no | `undefined` | no | JS property only (`attribute: false`). Body of `GET /mcp/tools`. Null/absent → "Tools unavailable." Empty `tools` with no `degraded` → "No tools are exposed for this guide." |
| `show-descriptions` | `boolean` | no | `true` | no | Attribute `show-descriptions`. Hide descriptions with the JS property `showDescriptions = false` (Boolean attributes cannot encode `false` by presence). |

`ToolInventory` (`openapi/tobor-kit.openapi.yaml`):

| Field | Type | Notes |
|---|---|---|
| `groups[]` | `{id, label}` | Group order already applied server-side. |
| `tools[]` | `Tool` | Dressed tools; hidden tools are already omitted. |
| `degraded[]` | `{server?, label?, error?}` | Unreachable MCP servers. Rendered; never dropped. |

`Tool`: `name`, `label`, `group` required; optional `description`, `icon`, `server`, `confirm`, `read_only`, `input_schema`.

`read_only` tools get a `read-only` badge; `confirm` tools get a `confirm` badge. Confirm is informational here — the two-step gate lives on `<tobor-task-menu>`.

## Events

| Event | Detail | When |
|---|---|---|
| `tobor-tool-select` | `{tool: Tool}` | A tool row is clicked. Bubbles, composed. |

The host (or `<tobor-guide-panel>`) may send `detail.tool.name` as advisory `task_id` on the next turn. The guide may still decline. This island does not confirm, invoke, or authorize.

```js
el.addEventListener('tobor-tool-select', (e) => {
  // e.detail.tool.name  e.g. "Github.PullCreate"
});
```

## Methods

None.

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Shared kit tokens (see `web/README.md`):

| Variable | Default | Used for |
|---|---|---|
| `--tobor-kit-bg` | `#12131a` | Host background (token surface) |
| `--tobor-kit-fg` | `#e8e9f0` | Text |
| `--tobor-kit-muted` | `#9aa0b4` | Group labels, tool names, descriptions, empty copy |
| `--tobor-kit-accent` | `#6ee7c7` | Hover / focus |
| `--tobor-kit-accent-fg` | `#08130f` | Text on accent |
| `--tobor-kit-border` | `#2c2f3d` | Row and badge borders |
| `--tobor-kit-warn` | `#f5c451` | Degraded notice, `confirm` badge |
| `--tobor-kit-radius` | `12px` | Corners |
| `--tobor-kit-font-family` | system UI stack | Font |

| `::part` | Node |
|---|---|
| `degraded` | Unreachable-server notice |
| `group` | Per-group `<section>` |
| `tool` | Tool `<button>` |

## `data-cy` / `data-testid`

`registry.yaml` `cy_prefix`: `tools`. Agent elements grandfather `data-testid` (no `data-cy` hooks listed). Do not invent `data-cy` names.

| Hook | Where |
|---|---|
| `data-testid="tools-unavailable"` | No `inventory` assigned |
| `data-testid="tools-empty"` | Inventory present, `tools` empty, no `degraded` |
| `data-testid="degraded-servers"` | `degraded[]` non-empty |
| `data-testid="degraded-unidentified"` | Degraded entry with no `server` |
| `data-server="{id}"` | Identified degraded server |
| `data-group="{id}"` | Group section |
| `data-tool="{tool.name}"` | Tool row button |

## Theming

Shadow + `--tobor-kit-*` tokens. Do not pierce Shadow DOM for layout; use `::part(degraded|group|tool)` and the tokens above. Light DOM is not used.
