# tobor-tool-list

Flat list of tools (including degraded entries) from the tool inventory.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/tool-list/tool-list.js"></script>

<tobor-tool-list></tobor-tool-list>
```

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `inventory` | Object | no | — | ToolInventory incl. `degraded[]`; null → "Tools unavailable" (property-only) |
| `show-descriptions` | Boolean | no | `true` | Show tool descriptions |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-tool-select` | `{tool}` | A tool is selected |

## Theming

Consumes the shared `--tobor-kit-*` tokens (see `web/README.md`).
