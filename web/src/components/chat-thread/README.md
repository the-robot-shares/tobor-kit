# tobor-chat-thread

Conversation thread that **composes** `<tobor-transcript-view>` (and its
`TranscriptStore`). Adds a participant roster, optional composer, and a
`messages` alias. Does not fork a second transcript implementation.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/chat-thread/chat-thread.js"></script>

<tobor-chat-thread show-composer></tobor-chat-thread>
```

```js
el.messages = [{role: 'user', text: 'Hello **world**', at: '2026-01-01T00:00:00Z', participant: 'alice'}];
el.participants = [{id: 'alice', name: 'Alice'}];
el.addEventListener('thread-send', (event) => {
  // event.detail.text — host owns POST /sessions/{id}/turn
});
```

Full options: [docs/configuration.md](docs/configuration.md). Host API: [docs/backend-requirements.md](docs/backend-requirements.md). Mount snippets: [examples/README.md](examples/README.md).

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `turns` | Array | no | `[]` | `Turn[]` forwarded to the inner view (property-only) |
| `messages` | Array | no | `[]` | `{id?, role, text, at?, participant?}[]`; nonempty wins over `turns` |
| `participants` | Array | no | `[]` | `{id, name}[]` roster (property-only) |
| `load` | Object | no | — | `{status: ok \| not_server_backed, ...}` (property-only) |
| `store` | Object | no | — | `TranscriptStore`; enables Clear (property-only) |
| `pending` | String | no | `""` | Streaming text |
| `show-composer` | Boolean | no | `false` | Render composer |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-transcript-clear` | — | Inner view cleared through the store (bubbles, composed) |
| `thread-send` | `{text}` | Composer submit (`show-composer`) |

## data-cy

`thread.root` `thread.composer` `thread.send`

## Theming

Shadow DOM. Shared `--tobor-kit-*` tokens (see `web/README.md`).

- `--tobor-kit-transcript-height` — `360px` (inner log)
