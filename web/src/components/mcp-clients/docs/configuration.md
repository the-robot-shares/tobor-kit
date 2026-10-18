# tobor-mcp-clients configuration

Tags in this family: `tobor-mcp-clients`.

Client roster for MCP OAuth / API-key grants. Properties down, events up. The
host loads the list, starts OAuth redirects, and persists revoke. This island
never redirects and never stores secrets.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `clients` | `{id, name, status, auth}[]` (`json`) | no | `[]` | n/a | Property-only. `auth` is `oauth` \| `api-key` (unknown → `oauth`). Rows without `id` are skipped. `status` is a host string (`connected`, `disconnected`, `pending`, `error`, …). Never an HTML attribute. |

## Events

| Name | Detail | When |
|---|---|---|
| `client-authorize` | `{id: string}` | Authorize click. Host starts OAuth (redirect) or collects an API key. Kit does **not** assign `location`. Bubbles, composed. |
| `client-revoke` | `{id: string}` | Revoke click. Host drops the grant. Bubbles, composed. |

Empty `id` does not emit. Both buttons render for every row.

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
| `root` | Outer wrapper |
| `client` | Per-client `<li>` |
| `status` | Status text |
| `authorize` | Authorize `<button>` |
| `revoke` | Revoke `<button>` |

## `data-cy` / `data-testid`

Must match `registry.yaml`:

| Hook | Node |
|---|---|
| `mcp.clients` | Outer wrapper |
| `mcp.authorize` | Authorize button (`data-client-id`) |
| `mcp.revoke` | Revoke button (`data-client-id`) |

No `data-testid` on this tag.

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Light-DOM class hooks are
not part of this island.
