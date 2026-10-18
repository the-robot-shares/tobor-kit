# tobor-persona-card / tobor-persona-picker

Shadow-DOM persona identity card and searchable picker. The **host supplies
the persona list**. Select is an event — the island never navigates or
fetches.

Full options: [docs/configuration.md](docs/configuration.md). Backend:
[docs/backend-requirements.md](docs/backend-requirements.md) (none — host
projects the roster). Mount snippets: [examples/README.md](examples/README.md).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/robot-avatar/robot-avatar.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/persona/persona-card.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/persona/persona-picker.js"></script>

<tobor-persona-card persona-id="nova" display-name="Nova" handle="@nova">
  <tobor-robot-avatar slot="avatar" state="idle" label="Nova"></tobor-robot-avatar>
</tobor-persona-card>

<tobor-persona-picker query=""></tobor-persona-picker>
```

```js
picker.personas = [
  {id: 'nova', name: 'Nova', handle: '@nova'},
  {id: 'orbit', name: 'Orbit', handle: '@orbit'},
  {id: 'pip', name: 'Pip'},
];
card.addEventListener('persona-select', (event) => {
  // event.detail.personaId — host switches persona. No navigation in the island.
});
picker.addEventListener('persona-select', (event) => {
  // event.detail.personaId — same contract.
});
```

`tobor-persona-card` extends `tobor-party-card` (slots `avatar`, `badges`,
`actions`).

## Properties / attributes

| Name | Tag | Type | Default | Description |
|---|---|---|---|---|
| `persona-id` | card | String | `""` | Select payload |
| `display-name` | card | String | `""` | Visible name |
| `handle` | card | String | `""` | Handle, as given |
| `personas` | picker | `{id, name, handle?}[]` | `[]` | Property-only roster |
| `query` | picker | String | `""` | Search filter |

## Events

| Event | Tag | Detail | Fired when |
|---|---|---|---|
| `persona-select` | card, picker | `{personaId}` | Select / item clicked |

## data-cy

`persona.card` `persona.picker` `persona.search` `persona.item`

## Theming

Shadow DOM. `--tobor-kit-*` tokens plus `--tobor-kit-party-avatar-size` (card)
and `--tobor-kit-persona-min` (picker grid). Parts: card inherits party-card
(`card`, `avatar`, `identity`, `name`, `handle`, `presence`, `badges`,
`actions`, `below`, `select`); picker: `picker`, `search`, `query`, `grid`,
`item`, `name`, `handle`, `empty`.
