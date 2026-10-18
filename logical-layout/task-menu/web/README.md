# tobor-task-menu

Menu of available tasks/tools from the tool inventory.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/task-menu/task-menu.js"></script>

<tobor-task-menu></tobor-task-menu>
```

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `inventory` | Object | no | — | ToolInventory from `GET /mcp/tools`; null → "No tasks available" (property-only) |
| `open` | Boolean | no | `false` | Menu open state (reflects) |

Confirm-capable tools confirm inline before selection. Escape closes the menu.

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-task-select` | `{tool}` | A task is selected (advisory — confirm tools confirm inline first) |

## Theming

Consumes the shared `--tobor-kit-*` tokens (see `web/README.md`).
