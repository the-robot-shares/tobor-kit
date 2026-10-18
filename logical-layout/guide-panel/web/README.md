# tobor-guide-panel

Floating/docked/inline assistant panel that renders a GuideProjection, submits turns, and manages task invocation.

Options: [docs/configuration.md](docs/configuration.md). Host API: [docs/backend-requirements.md](docs/backend-requirements.md). Snippets: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/guide-panel/guide-panel.js"></script>

<tobor-guide-panel base-url="https://api.example.com" token="..." placement="floating"></tobor-guide-panel>
```

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `guide` | Object | no | — | GuideProjection config; fetched via `client` on connect if omitted (property-only) |
| `client` | Object | in practice | — | ToborKitClient instance; one of `client`/`base-url` required (property-only) |
| `baseUrl` (`base-url`) | String | no | — | API base URL used to construct a client |
| `token` | String | no | — | Bearer token |
| `placement` | String | no | `floating` | `floating \| docked \| inline`; overridden by `guide.ui.panel.placement` |
| `startExpanded` (`start-expanded`) | Boolean | no | `false` | Start expanded (also `guide.ui.panel.start_expanded`) |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-task-invoked` | `{task_id}` | A task is selected |
| `tobor-turn-submitted` | `{input, task_id?}` | A turn is submitted |
| `tobor-state-change` | `{state}` | Each SSE state event |
| `tobor-turn-error` | `{error: {code, message}}` | A turn fails |
| `tobor-turn-message` | `{turn}` | An assistant turn finalizes |

## Theming

Consumes the shared `--tobor-kit-*` tokens (see `web/README.md`).

- `--tobor-kit-panel-width` — `360px` floating; `480px` docked/inline (`max-width`)
