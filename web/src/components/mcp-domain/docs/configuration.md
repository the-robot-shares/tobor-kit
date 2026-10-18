# tobor-mcp-domain configuration

Tags in this family: `tobor-mcp-domain`.

Admin island for per-tool MCP visibility. Properties down, events up. The host
persists. Composes `<tobor-tool-list>` to preview tools marked `visible`.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `tools` | `{name, visibility}[]` (`json`) | no | `[]` | n/a | Property-only. `visibility` is `visible` \| `discoverable` \| `disabled`. Unknown values become `disabled`. Rows without `name` are skipped. Never an HTML attribute. |
| `inventory` | `ToolInventory` (`json`) | no | — | n/a | Property-only optional dressed inventory (`groups`, `tools`, `degraded[]`). Supplies labels and is filtered into the composed `<tobor-tool-list>`. |

`visible` — shown in the guide UI. `discoverable` — agent may find, not listed
in the menu. `disabled` — neither. Server-side allow/deny remains the
authorization boundary.

## Events

| Name | Detail | When |
|---|---|---|
| `tool-visibility-change` | `{name: string, visibility: "visible"\|"discoverable"\|"disabled"}` | Visibility `<select>` `change`. Local `tools` updates. Bubbles, composed. Not fired when the host assigns `tools`. |

Preview clicks on the inner `<tobor-tool-list>` are stopped (`tobor-tool-select`
does not leave this island).

## Methods

None.

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Style through tokens on the host (or an ancestor); do not pierce.

| Token | Default |
|---|---|
| `--tobor-kit-font-family` | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--tobor-kit-bg` | `#12131a` |
| `--tobor-kit-surface` | `#1b1d27` |
| `--tobor-kit-fg` | `#e8e9f0` |
| `--tobor-kit-muted` | `#9aa0b4` |
| `--tobor-kit-accent` | `#6ee7c7` |
| `--tobor-kit-accent-fg` | `#08130f` |
| `--tobor-kit-border` | `#2c2f3d` |
| `--tobor-kit-danger` | `#ff6b6b` |
| `--tobor-kit-warn` | `#f5c451` |
| `--tobor-kit-radius` | `12px` |
| `--tobor-kit-gap` | `12px` |
| `--tobor-kit-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` |
| `--tobor-kit-duration` | `320ms` |

Shared token sheet lives in `web/src/components/mode-toggle/theme.ts`.

| `::part()` | Node |
|---|---|
| `root` | Outer stack |
| `tools` | Admin `<ul>` |
| `tool` | Per-tool `<li>` |
| `visibility` | Visibility `<select>` |
| `preview` | Inner `<tobor-tool-list>` |

## `data-cy` / `data-testid`

Must match `registry.yaml`:

| Hook | Node |
|---|---|
| `mcp.domain` | Outer stack |
| `mcp.tool` | Each tool row (`data-tool`, `data-visibility`) |

No `data-testid` on this tag. Inner `<tobor-tool-list>` keeps its own hooks.

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Light-DOM class hooks are
not part of this island.
