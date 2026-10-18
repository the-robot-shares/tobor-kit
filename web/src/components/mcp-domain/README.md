# tobor-mcp-domain

Tri-state MCP tool visibility (`visible` | `discoverable` | `disabled`).
Events up; the host persists. Composes `<tobor-tool-list>` as a preview of
currently **visible** tools.

Options: [docs/configuration.md](docs/configuration.md). Backend:
[docs/backend-requirements.md](docs/backend-requirements.md) (host persists).
Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-domain/tobor-mcp-domain.js"></script>

<tobor-mcp-domain></tobor-mcp-domain>
```

```js
el.tools = [
  {name: 'Github.PullCreate', visibility: 'visible'},
  {name: 'Filesystem.Write', visibility: 'disabled'},
];
el.addEventListener('tool-visibility-change', (event) => {
  // event.detail {name, visibility} — host persists
});
```

`tools` and `inventory` are JS properties, not HTML attributes.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `tools` | `{name, visibility}[]` | no | `[]` | Property-only policy |
| `inventory` | `ToolInventory` | no | — | Property-only; labels rows and feeds the preview list |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tool-visibility-change` | `{name, visibility}` | A visibility select changes |

## data-cy

`mcp.domain` `mcp.tool`

## Theming

Shadow DOM. Shared `--tobor-kit-*` tokens (see `web/README.md`).
