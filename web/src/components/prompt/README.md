# prompt family

Shadow-DOM prompt islands. Host loads prompts/history and persists
`prompt-star` / `prompt-fork`. Bodies are **source text** in `<pre>` — never
`unsafeHTML`.

Options: [docs/configuration.md](docs/configuration.md). Backend: [docs/backend-requirements.md](docs/backend-requirements.md) (host loads/saves). Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/prompt/tobor-prompt-library.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/prompt/tobor-prompt-history.js"></script>

<tobor-prompt-library></tobor-prompt-library>
<tobor-prompt-history></tobor-prompt-history>
```

```js
library.prompts = [{id: 'sys', title: 'System', body: 'Be helpful.', starred: true}];
library.addEventListener('prompt-select', (event) => {
  // event.detail.id — host applies the prompt
});
library.addEventListener('prompt-star', (event) => {
  // event.detail {id, starred} — host persists
});
history.entries = [{id: 'sys-v1', title: 'System', at: '2026-01-01T12:00:00Z', version: 1}];
history.addEventListener('prompt-fork', (event) => {
  // event.detail.id — host copies the revision
});
history.addEventListener('prompt-star', (event) => {
  // event.detail {id, starred} — host persists
});
```

## tobor-prompt-library

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `prompts` | `{id, title, body, starred?}[]` | no | `[]` | Property-only roster |
| `query` | String | no | `""` | Search filter (id, title, body) |
| `selected-id` | String | no | `""` | Highlighted prompt id |

| Event | Detail | Fired when |
|---|---|---|
| `prompt-select` | `{id}` | A prompt is chosen |
| `prompt-star` | `{id, starred}` | Star is toggled. Host persists. |

## tobor-prompt-history

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `entries` | `{id, title, at, version?, starred?}[]` | no | `[]` | Property-only revisions |
| `diff` | `{left?: {label?, body}, right?: {label?, body}}` | no | `null` | Side-by-side source text |

| Event | Detail | Fired when |
|---|---|---|
| `prompt-fork` | `{id}` | Fork is clicked. Host copies. |
| `prompt-star` | `{id, starred}` | Star is toggled. Host persists. |

Slot `diff` replaces the built-in side-by-side panes.

## data-cy

`prompt.library` `prompt.item` `prompt.star` `prompt.history` `prompt.fork`

## Theming

Shadow DOM. Shared `--tobor-kit-*` tokens (see `web/README.md`).

- `--tobor-kit-prompt-body-max-height` — library snippet `6rem`, history diff `24rem`
- `--tobor-kit-prompt-diff-min` — `12rem`
