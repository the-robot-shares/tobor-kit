# tobor-mcp-config configuration

Tags in this family: `tobor-mcp-config`.

Transport / server params form. Properties down, events up. The host validates
and persists. This island does not connect to MCP servers and carries no secrets.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `url` | string | no | `""` | yes | HTTP/SSE endpoint or stdio command path. Host validates. Input is `type=text` so paths work. |
| `transport` | `"stdio"\|"http"\|"sse"` | no | `"http"` | yes | Unknown values coerce to `http` on save / render. |
| `extras` | `Record<string, unknown>` (`json`) | no | `null` | n/a | Property-only. Passed through on `config-change` when nonempty. **Never** tokens, `env`, or `Authorization`. Never an HTML attribute. |

## Events

| Name | Detail | When |
|---|---|---|
| `config-change` | `{url: string, transport: "stdio"\|"http"\|"sse", extras?: object}` | Save / submit. `url` is trimmed. `extras` omitted when null/empty. Bubbles, composed. Not fired when the host assigns properties. |

The island does **not** validate URL shape, TLS, or that a stdio binary exists.

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
| `root` | `<form>` |
| `url` | URL / command `<input>` |
| `transport` | Transport `<select>` |
| `save` | Save `<button>` |

## `data-cy` / `data-testid`

Must match `registry.yaml`:

| Hook | Node |
|---|---|
| `mcp.config` | `<form>` |
| `mcp.save` | Save button |

No `data-testid` on this tag.

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Light-DOM class hooks are
not part of this island.
