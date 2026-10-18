# Configuration — persona family

Tags in this family: **`tobor-persona-card`**, **`tobor-persona-picker`**.

Shadow-DOM islands. The host projects the roster (card fields or picker
`personas`). Select emits `persona-select`; the island does not navigate or
fetch. `tobor-persona-card` extends `tobor-party-card` (same `avatar` /
`badges` / `actions` slots).

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Properties / attributes

### `tobor-persona-card`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `persona-id` (`personaId`) | `string` | no | `""` | yes | Select CTA is disabled when empty. Payload of `persona-select`. |
| `display-name` (`displayName`) | `string` | no | `""` | yes | Visible name. Inherited from `tobor-party-card`. Initials fallback when `avatar` is empty. |
| `handle` | `string` | no | `""` | yes | Rendered as given (no `@` is added). Inherited from `tobor-party-card`. |
| `presence` | `'online' \| 'away' \| 'offline' \| 'hidden'` | no | `offline` | yes | Inherited from `tobor-party-card`. Unknown values clamp to `offline`. `hidden` conceals the indicator. |

### `tobor-persona-picker`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `personas` | `{id: string, name: string, handle?: string}[]` | no | `[]` | no | **Property-only** (`attribute: false`). Host supplies the list. Rows without `id` or `name` are skipped. |
| `query` | `string` | no | `""` | yes | Case-insensitive filter over `id`, `name`, and `handle`. Bound to the search field. |

`personas` is never an HTML attribute.

## Events

Bubbling, composed `CustomEvent`s via `emit()`.

| Event | Tag | Detail | When |
|---|---|---|---|
| `persona-select` | `tobor-persona-card` | `{personaId: string}` | **Select** clicked (`persona-id` nonempty). Host switches persona. |
| `persona-select` | `tobor-persona-picker` | `{personaId: string}` | Grid item clicked. Host switches persona. |

## Methods

None beyond `HTMLElement` / Lit lifecycle.

## Slots

| Name | Tags | Notes |
|---|---|---|
| `avatar` | card | Supports `<tobor-robot-avatar>` or an `<img>`. Empty → initials from `display-name` (or `?`). |
| `badges` | card | Extra badges after built-in party badges. |
| `actions` | card | Extra actions before the built-in Select button. |

`tobor-persona-picker` has no slots. No default slot on either tag.

## CSS custom properties / `::part()`

Shadow DOM. Tokens from `mode-toggle/theme` (`toborKitTokens`, `toborKitControls`). Card also uses `partyCardStyles`.

| Token | Default | Role |
|---|---|---|
| `--tobor-kit-font-family` | system UI stack | Font |
| `--tobor-kit-bg` | `#12131a` | Avatar fallback fill (card) |
| `--tobor-kit-surface` | `#1b1d27` | Card / item / input surface |
| `--tobor-kit-fg` | `#e8e9f0` | Name / body |
| `--tobor-kit-muted` | `#9aa0b4` | Handle, labels, empty copy |
| `--tobor-kit-accent` | `#6ee7c7` | Focus, hover border, online dot |
| `--tobor-kit-accent-fg` | `#08130f` | Pressed button |
| `--tobor-kit-border` | `#2c2f3d` | Card / item / input border |
| `--tobor-kit-danger` | `#ff6b6b` | Token sheet |
| `--tobor-kit-warn` | `#f5c451` | Away dot (card) |
| `--tobor-kit-radius` | `12px` | Card / item radius |
| `--tobor-kit-gap` | `12px` | Padding and grid gap |
| `--tobor-kit-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` | Token sheet |
| `--tobor-kit-duration` | `320ms` | Token sheet |
| `--tobor-kit-party-avatar-size` | `48px` | Card avatar box (also `--tobor-kit-robot-size` on the card host) |
| `--tobor-kit-persona-min` | `16rem` | Picker grid `minmax` |

| `::part()` | Tag | Node |
|---|---|---|
| `card` | card | Root `<article>` |
| `avatar` | card | Avatar box |
| `identity` | card | Name + handle column |
| `name` | both | Display name |
| `handle` | both | Handle |
| `presence` | card | Presence dot |
| `badges` | card | Badge row |
| `actions` | card | Actions row (slot + Select) |
| `below` | card | Below-identity region |
| `select` | card | Select `<button type="button">` |
| `picker` | picker | Root wrapper (`data-cy="persona.picker"`) |
| `search` | picker | Search field wrapper |
| `query` | picker | Search `<input type="search">` |
| `grid` | picker | Item `<ul>` |
| `item` | picker | Item `<button>` |
| `empty` | picker | Empty-state copy |

No Light-DOM class hooks.

## `data-cy` / `data-testid`

Must match `registry.yaml`. No `data-testid` on these tags. Hooks live in Shadow DOM.

| Hook | Tag | Node |
|---|---|---|
| `persona.card` | `tobor-persona-card` | Card `<article>` |
| `persona.picker` | `tobor-persona-picker` | Picker root |
| `persona.search` | `tobor-persona-picker` | Search `<input type="search">` |
| `persona.item` | `tobor-persona-picker` | Roster item `<button>` (`data-persona-id`) |

Prefix: `persona`. Inherited party-card hooks (`party.name`, `party.handle`, `party.presence`) remain on the card host.

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Style the host (or an ancestor);
do not pierce. Slotted `tobor-robot-avatar` inherits `--tobor-kit-robot-size` from
the card host unless the avatar sets its own. Light-DOM class hooks are not part of
this family.
