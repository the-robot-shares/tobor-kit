# tobor-mcp-config

MCP transport / server params form (`url`, `transport` = `stdio` | `http` |
`sse`). Emits `config-change`; the **host** validates and persists. No secrets
on the tag.

Options: [docs/configuration.md](docs/configuration.md). Backend:
[docs/backend-requirements.md](docs/backend-requirements.md) (host persists).
Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-config/tobor-mcp-config.js"></script>

<tobor-mcp-config url="https://mcp.example.test/mcp" transport="http"></tobor-mcp-config>
```

```js
el.addEventListener('config-change', (event) => {
  // event.detail {url, transport, extras?} — host validates & persists
});
```

`extras` is a JS property, not an HTML attribute. Never put tokens there.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `url` | String | no | `""` | HTTP/SSE URL or stdio command (reflects) |
| `transport` | `"stdio"\|"http"\|"sse"` | no | `"http"` | Transport (reflects) |
| `extras` | Object | no | `null` | Property-only non-secret extras |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `config-change` | `{url, transport, extras?}` | Save is clicked |

## data-cy

`mcp.config` `mcp.save`

## Theming

Shadow DOM. Shared `--tobor-kit-*` tokens (see `web/README.md`).
