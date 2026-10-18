# tobor-transcript-view

Scrollable conversation transcript with streaming pending text and optional server-backed loading.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/transcript-view/transcript-view.js"></script>

<tobor-transcript-view></tobor-transcript-view>
```

Full options: [docs/configuration.md](docs/configuration.md). Host API: [docs/backend-requirements.md](docs/backend-requirements.md). Mount snippets: [examples/README.md](examples/README.md).

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `turns` | Array | no | `[]` | Turn list; ignored when `load.status = not_server_backed` (property-only) |
| `load` | Object | no | — | `{status: ok \| not_server_backed, ...}` (property-only) |
| `store` | Object | no | — | TranscriptStore; presence enables Clear (property-only) |
| `pending` | String | no | `""` | Streaming text |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-transcript-clear` | — | After the transcript is cleared |

## Theming

Consumes the shared `--tobor-kit-*` tokens (see `web/README.md`).

- `--tobor-kit-transcript-height` — `360px`
