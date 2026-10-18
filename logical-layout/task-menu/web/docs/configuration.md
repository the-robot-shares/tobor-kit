# tobor-task-menu configuration

Task/context menu over the server-dressed MCP inventory. The host (or
`<tobor-guide-panel>`) assigns `inventory` from `GET /mcp/tools`; this island
renders that payload **verbatim**, including `degraded[]`. Selecting a tool
names it for the next guide turn — it does **not** invoke the tool.

## Tags

| Tag | Role |
|---|---|
| `tobor-task-menu` | Overlay task menu with inline confirm for `confirm: true` tools |

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `inventory` | `ToolInventory \| null` | no | `undefined` | no | **Property-only.** `{groups, tools, degraded[]}`. `null` / omitted / empty `tools` → "No tasks available." Do not serialize as an HTML attribute. |
| `open` | `boolean` | no | `false` | yes | Menu visibility. Closing clears any in-progress confirm step. |

### `inventory` shape (`ToolInventory`)

| Field | Type | Notes |
|---|---|---|
| `groups` | `{id, label}[]` | Server-dressed group order |
| `tools` | `Tool[]` | Already filtered (allow/deny) and overlaid (`mcp.menu`) |
| `degraded` | `{server?, label?, error?}[]` | Unreachable **non-required** MCP servers. Always render; a short list is information. |

`Tool` (contract): `name`, `label`, `group` required; optional `description`, `icon`, `server`, `confirm`, `read_only`, `input_schema`.

## Confirm-capable tools

When `tool.confirm === true`:

1. The menuitem label is suffixed with `⚠`.
2. The first click does **not** emit `tobor-task-select`. It shows an inline prompt: `Run “{label}”? This action is not read-only.`
3. **Run it** (`data-testid="task-confirm-yes"`) emits `tobor-task-select` and closes the menu.
4. **Cancel**, Escape, or closing the menu clears the confirm step without emitting.

Non-confirm tools emit immediately on click and close the menu.

This confirm step is UI-only. It is **not** authorization — the Guide API still
enforces `mcp.allow` / `mcp.deny` and may decline the advisory `task_id` on
`POST /sessions/{id}/turn`. Hosts that need a browsable list without confirm
use `<tobor-tool-list>`.

## Events

| Event | Detail | When |
|---|---|---|
| `tobor-task-select` | `{tool: Tool}` | A task is selected (after the confirm step when `confirm` is true). Bubbles, composed. **Advisory** — the island does not call the MCP tool or open a turn. |

```js
el.addEventListener('tobor-task-select', (e) => {
  // e.detail.tool.name  e.g. "Github.PullCreate"
  // Host may send that as task_id on the next POST /sessions/{id}/turn.
});
```

## Methods

None.

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Restyle via kit tokens (see `web/src/components/mode-toggle/theme.ts`):

| Token | Default | Used for |
|---|---|---|
| `--tobor-kit-bg` | `#12131a` | Panel background |
| `--tobor-kit-fg` | `#e8e9f0` | Body text |
| `--tobor-kit-muted` | `#9aa0b4` | Empty-state copy |
| `--tobor-kit-accent` | `#6ee7c7` | Button hover / focus |
| `--tobor-kit-accent-fg` | `#08130f` | Pressed control foreground |
| `--tobor-kit-border` | `#2c2f3d` | Buttons, panel border |
| `--tobor-kit-warn` | `#f5c451` | Degraded notice |
| `--tobor-kit-radius` | `12px` | Corners |
| `--tobor-kit-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` | Panel shadow |
| `--tobor-kit-font-family` | system UI stack | Font |

| `::part()` | Node |
|---|---|
| `trigger` | “Tasks ▴” button |
| `item` | Each `role="menuitem"` tool button |
| `degraded` | Unreachable-server notice |

## `data-cy` / `data-testid` hooks

Registry freeze: `web/registry.yaml` → `cy_prefix: task`. No `data-cy` names are listed for this tag; do not invent them. Grandfathered `data-testid` / data attributes:

| Hook | Where |
|---|---|
| `[data-testid="task-menu-trigger"]` | Open/close button |
| `[data-testid="task-menu-panel"]` | `role="menu"` panel (only while `open`) |
| `[data-testid="task-menu-degraded"]` | `degraded[]` notice |
| `[data-testid="task-menu-degraded-unidentified"]` | Degraded row with no `server` |
| `[data-testid="task-confirm-text"]` | Inline confirm copy |
| `[data-testid="task-confirm-yes"]` | “Run it” |
| `[data-testid="task-menu-empty"]` | “No tasks available.” |
| `[data-tool]` | Tool name on each menuitem |

## Theming

**Shadow DOM** + shared `--tobor-kit-*` tokens. Hosts apply a guide projection `ui.theme` map with `applyThemeVars` (turns keys into `--tobor-kit-<key>`). Light-DOM class hooks are not part of this island. Keyboard: Escape on the panel sets `open` to false.
