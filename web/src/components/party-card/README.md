# tobor-party-card / tobor-agent-card / tobor-user-card

Shadow-DOM identity cards. The host supplies the projection (name, handle,
presence, badges). Chat / Profile are events — the island never navigates.

Full options: [docs/configuration.md](docs/configuration.md). Backend:
[docs/backend-requirements.md](docs/backend-requirements.md) (none — host
projects). Mount snippets: [examples/README.md](examples/README.md).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/robot-avatar/robot-avatar.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/party-card/agent-card.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/party-card/user-card.js"></script>

<tobor-agent-card display-name="Nova" handle="@nova" presence="online" agent-id="nova" model-badge="gpt-4o">
  <tobor-robot-avatar slot="avatar" state="idle" label="Nova"></tobor-robot-avatar>
</tobor-agent-card>

<tobor-user-card display-name="Keith" handle="@keith" presence="away" user-id="keith" role="Owner" org="Noizu"></tobor-user-card>
```

```js
agent.capabilities = ['voice', 'tools'];
agent.addEventListener('agent-chat', (event) => {
  // event.detail.agentId — host opens chat. No navigation in the island.
});
user.addEventListener('user-profile', (event) => {
  // event.detail.userId — host opens the profile.
});
```

`tobor-party-card` is the registered base (shared chrome + slots). Prefer the
agent/user tags in product UI.

## Properties / attributes

| Name | Tag | Type | Default | Description |
|---|---|---|---|---|
| `display-name` | all | String | `""` | Visible name |
| `handle` | all | String | `""` | Handle, as given |
| `presence` | all | `online` \| `away` \| `offline` \| `hidden` | `offline` | Presence dot; `hidden` conceals it |
| `agent-id` | agent | String | `""` | Chat payload |
| `model-badge` | agent | String | `""` | Model / provider badge |
| `show-capabilities` | agent | Boolean | `true` | Show capability chips |
| `capabilities` | agent | `string[]` | `[]` | Property-only chips |
| `user-id` | user | String | `""` | Profile payload |
| `role` | user | String | `""` | Role badge |
| `org` | user | String | `""` | Org badge |

## Events

| Event | Tag | Detail | Fired when |
|---|---|---|---|
| `agent-chat` | agent | `{agentId}` | Chat clicked |
| `user-profile` | user | `{userId}` | Profile clicked |

## data-cy

`party.card` `party.name` `party.handle` `party.presence`
`agent.card` `agent.chat` `agent.caps`
`user.card` `user.profile`

## Theming

Shadow DOM. `--tobor-kit-*` tokens plus `--tobor-kit-party-avatar-size` (also
sets `--tobor-kit-robot-size` on the host so slotted `tobor-robot-avatar` fits).
Parts: `card`, `avatar`, `identity`, `name`, `handle`, `presence`, `badges`,
`actions`, `below`, `model`, `caps`, `chat`, `role`, `org`, `profile`.
