# tobor-mcp-clients

List of MCP clients `{id, name, status, auth: oauth|api-key}`. Emits
`client-authorize` / `client-revoke`. **OAuth redirect is host-owned** — the
island never assigns `location` and never stores secrets.

Options: [docs/configuration.md](docs/configuration.md). Backend:
[docs/backend-requirements.md](docs/backend-requirements.md) (host persists).
Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mcp-clients/tobor-mcp-clients.js"></script>

<tobor-mcp-clients></tobor-mcp-clients>
```

```js
el.clients = [
  {id: 'github', name: 'GitHub', status: 'disconnected', auth: 'oauth'},
  {id: 'search', name: 'Search', status: 'connected', auth: 'api-key'},
];
el.addEventListener('client-authorize', (event) => {
  // event.detail {id} — host starts OAuth or collects a key
});
el.addEventListener('client-revoke', (event) => {
  // event.detail {id} — host drops the grant
});
```

`clients` is a JS property, not an HTML attribute.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `clients` | `{id, name, status, auth}[]` | no | `[]` | Property-only roster |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `client-authorize` | `{id}` | Authorize is clicked |
| `client-revoke` | `{id}` | Revoke is clicked |

## data-cy

`mcp.clients` `mcp.authorize` `mcp.revoke`

## Theming

Shadow DOM. Shared `--tobor-kit-*` tokens (see `web/README.md`).
