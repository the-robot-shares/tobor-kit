# tobor-mode-toggle

Input-mode switch rendered as a radiogroup (e.g. text/voice).

Full options: [docs/configuration.md](./docs/configuration.md). Backend:
[docs/backend-requirements.md](./docs/backend-requirements.md) (none).
Copy-paste hosts: [examples/](./examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/mode-toggle/mode-toggle.js"></script>

<tobor-mode-toggle></tobor-mode-toggle>
```

`modes` is a JS property (`el.modes = ['text', 'voice']`), not an HTML attribute.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `modes` | Array | no | `["text"]` | Modes in display order (property-only) |
| `mode` | String | no | `text` | Active mode |
| `disabled` | Boolean | no | `false` | Disable interaction |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-mode-change` | `{mode, previous}` | The active mode changes |

## Slots / methods

None.

## `::part()` / hooks

`part="group"` (radiogroup), `part="mode"` (each radio). Buttons expose
`data-mode`. No `data-cy` names in `registry.yaml`.

## Theming

Shadow DOM. Consumes the shared `--tobor-kit-*` tokens (see `theme.ts` /
`web/README.md`).
