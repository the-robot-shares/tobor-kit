# tobor-configurator

Schema-driven playground: form + live preview + copyable HTML snippet for any kit tag.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/configurator/tobor-configurator.js"></script>

<tobor-configurator>
  <script type="application/json">
    {
      "tag": "tobor-robot-avatar",
      "group": "agent",
      "importPath": "components/robot-avatar/robot-avatar.js",
      "demoHtml": "<tobor-robot-avatar state=\"idle\" label=\"Guide\"></tobor-robot-avatar>",
      "backend": "none",
      "fields": [
        {"attr": "state", "type": "select", "options": ["idle", "listening", "thinking", "speaking"], "default": "idle"},
        {"attr": "label", "type": "string", "default": "Guide"}
      ]
    }
  </script>
</tobor-configurator>
```

`schema` is a JS property (`el.schema = configurator`), not an HTML attribute. Alternatively set `schema-src` to a JSON URL.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `schema` | `ConfiguratorSchema` | no | — | Property-only schema object |
| `schema-src` | String (url) | no | `""` | JSON URL fetched with `credentials: 'omit'` |

Resolution order: `schema` property, then child `<script type="application/json">`, then `schema-src`.

## Events

| Event | Detail | Fired when |
|---|---|---|
| `configurator-change` | `{tag, attributes, slots}` | Schema resolves and after each field edit |
| `configurator-apply` | `{tag, attributes, slots}` | `apply()` or the Apply button |

## Methods

| Method | Description |
|---|---|
| `apply()` | Dispatch `configurator-apply` with the current snapshot |

## Theming

Shadow DOM. Consumes the shared `--tobor-kit-*` tokens (see `theme.ts`).

## Docs

- [docs/configuration.md](docs/configuration.md) — options, slots, events, `data-cy`
- [docs/backend-requirements.md](docs/backend-requirements.md) — none required
- [examples/](examples/) — CDN, npm, and page-serving hosts
