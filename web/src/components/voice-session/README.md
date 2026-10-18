# tobor-voice-session

Voice interaction wrapper that drives an adapter for push-to-talk / click-toggle sessions.

Options: [docs/configuration.md](docs/configuration.md). Host API: [docs/backend-requirements.md](docs/backend-requirements.md). Snippets: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/voice-session/voice-session.js"></script>

<tobor-voice-session></tobor-voice-session>
```

Assign `client` and `voice` as JS properties (not attributes). `POST /voice/token` is minted by the Guide API; 409 for `native` is expected.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `client` | Object | yes | — | ToborKitClient for the adapter (property-only) |
| `voice` | Object | no | — | Projection voice block: adapter name + options (property-only) |
| `push-to-talk` | Boolean | no | `false` | Hold-to-talk vs click-toggle |
| `adapterFactory` (`adapter-factory`) | Object | no | — | Test seam (property-only) |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-voice-state` | `{state}` | Session state changes |
| `tobor-voice-transcript` | `{entry: {speaker, text, final}}` | A transcript entry arrives |
| `tobor-voice-error` | `{error}` | The session errors |

## Methods

| Method | Signature | Purpose |
|---|---|---|
| `start` | `start(): Promise<void>` | Start the voice session |
| `stop` | `stop(): Promise<void>` | Stop the voice session |
| `sendText` | `sendText(text)` | Send text through the adapter |

## Slots

None.

## Theming

Shadow DOM. Consumes the shared `--tobor-kit-*` tokens (see `web/README.md`). Parts: `mic`, `status`. Grandfathered hooks: `[data-testid="voice-mic"]`, `[data-testid="voice-status"]`.
