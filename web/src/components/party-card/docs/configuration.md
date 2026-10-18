# Configuration — party-card family

Tags in this family: **`tobor-party-card`**, **`tobor-agent-card`**, **`tobor-user-card`**.

Shadow-DOM identity cards. The host projects name / handle / presence (and
agent or user fields). Chat and Profile emit events; the island does not
navigate. `tobor-agent-card` and `tobor-user-card` extend `tobor-party-card`.
The base tag is registered but not typically used standalone.

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Properties / attributes

### Shared (`tobor-party-card` and subclasses)

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `display-name` (`displayName`) | `string` | no | `""` | yes | Visible name. Initials fallback uses up to two initials when the `avatar` slot is empty. |
| `handle` | `string` | no | `""` | yes | Rendered as given (no `@` is added). |
| `presence` | `'online' \| 'away' \| 'offline' \| 'hidden'` | no | `offline` | yes | Unknown values clamp to `offline`. `hidden` sets `hidden` on the presence dot. |

### `tobor-agent-card`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `agent-id` (`agentId`) | `string` | no | `""` | yes | Chat CTA is disabled when empty. Payload of `agent-chat`. |
| `model-badge` (`modelBadge`) | `string` | no | `""` | yes | Model / provider badge. Omitted when empty. |
| `show-capabilities` (`showCapabilities`) | `boolean` | no | `true` | no | Capability list. HTML: omit (true), or `show-capabilities="false"`. |
| `capabilities` | `string[]` | no | `[]` | no | **Property-only** (`attribute: false`). Trimmed nonempty strings become chips. |

Boolean properties elsewhere in this family default to `false`. `show-capabilities` is the exception.

### `tobor-user-card`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `user-id` (`userId`) | `string` | no | `""` | yes | Profile CTA is disabled when empty. Payload of `user-profile`. |
| `role` | `string` | no | `""` | yes | Job-title badge (overrides `Element.role`). Omitted from the badge row when empty. Not an ARIA landmark. |
| `org` | `string` | no | `""` | yes | Organization badge. Omitted when empty. |

## Events

Bubbling, composed `CustomEvent`s via `emit()`. `tobor-party-card` emits none.

| Event | Tag | Detail | When |
|---|---|---|---|
| `agent-chat` | `tobor-agent-card` | `{agentId: string}` | **Chat** clicked (`agent-id` nonempty). Host opens the conversation. |
| `user-profile` | `tobor-user-card` | `{userId: string}` | **Profile** clicked (`user-id` nonempty). Host opens the profile. |

## Methods

None beyond `HTMLElement` / Lit lifecycle.

## Slots

| Name | Tags | Notes |
|---|---|---|
| `avatar` | all | Supports `<tobor-robot-avatar>` or an `<img>`. Empty → initials from `display-name` (or `?`). |
| `badges` | all | Extra badges after the built-in model / role / org badges. |
| `actions` | all | Extra actions before the built-in Chat / Profile button. |

No default slot.

## CSS custom properties / `::part()`

Shadow DOM. Tokens from `mode-toggle/theme` (`toborKitTokens`, `toborKitControls`).

| Token | Default | Role |
|---|---|---|
| `--tobor-kit-font-family` | system UI stack | Font |
| `--tobor-kit-bg` | `#12131a` | Avatar fallback fill |
| `--tobor-kit-surface` | `#1b1d27` | Card surface |
| `--tobor-kit-fg` | `#e8e9f0` | Name / body |
| `--tobor-kit-muted` | `#9aa0b4` | Handle, outline badges, offline dot |
| `--tobor-kit-accent` | `#6ee7c7` | Online dot, model badge, initials, focus |
| `--tobor-kit-accent-fg` | `#08130f` | Model badge / pressed button |
| `--tobor-kit-border` | `#2c2f3d` | Card / badge / button border |
| `--tobor-kit-danger` | `#ff6b6b` | Unused on this family (token sheet) |
| `--tobor-kit-warn` | `#f5c451` | Away dot |
| `--tobor-kit-radius` | `12px` | Card radius |
| `--tobor-kit-gap` | `12px` | Card padding and column gap |
| `--tobor-kit-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` | Token sheet (card does not apply a drop shadow) |
| `--tobor-kit-duration` | `320ms` | Token sheet |
| `--tobor-kit-party-avatar-size` | `48px` | Avatar box. Also assigned to `--tobor-kit-robot-size` on `:host` so slotted `tobor-robot-avatar` matches. |

| `::part()` | Node |
|---|---|
| `card` | Root `<article>` |
| `avatar` | Avatar box |
| `identity` | Name + handle column |
| `name` | Display name |
| `handle` | Handle |
| `presence` | Presence dot |
| `badges` | Badge row (built-in + slot) |
| `actions` | Actions row (slot + CTA) |
| `below` | Below-identity region (capability chips) |
| `model` | Agent model badge |
| `caps` | Agent capability `<ul>` |
| `chat` | Agent Chat button |
| `role` | User role badge |
| `org` | User org badge |
| `profile` | User Profile button |

No Light-DOM class hooks.

## `data-cy` / `data-testid`

Must match `registry.yaml`. No `data-testid` on these tags. Hooks live in Shadow DOM.

| Hook | Tag | Node |
|---|---|---|
| `party.card` | `tobor-party-card` | Card `<article>` |
| `party.name` | all | Display name |
| `party.handle` | all | Handle |
| `party.presence` | all | Presence dot (`data-presence`; `hidden` when presence is `hidden`) |
| `agent.card` | `tobor-agent-card` | Card `<article>` |
| `agent.chat` | `tobor-agent-card` | Chat `<button type="button">` |
| `agent.caps` | `tobor-agent-card` | Capability `<ul>` (omitted when `show-capabilities` is false) |
| `user.card` | `tobor-user-card` | Card `<article>` |
| `user.profile` | `tobor-user-card` | Profile `<button type="button">` |

Prefixes: `party`, `agent`, `user`.

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Style the host (or an ancestor);
do not pierce. Slotted `tobor-robot-avatar` inherits `--tobor-kit-robot-size` from
this host unless the avatar sets its own. Light-DOM class hooks are not part of
this family.
