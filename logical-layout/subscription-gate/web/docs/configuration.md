# Configuration — noizu-subscription-gate

Tags in this family: **`noizu-subscription-gate`**.

Shadow-DOM entitled gate. The default slot is shown only when `entitled` is true. Blocked state shows a message and an upgrade link. Hosts own entitlement truth, payments, session cookies, and navigation. The element carries no secrets.

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Tags

| Tag | File |
|---|---|
| `noizu-subscription-gate` | `noizu-subscription-gate.ts` |

## Properties / attributes

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `entitled` | `boolean` | no | `false` | yes | Host-owned. Default slot renders only when true. Optional `check-url` may set this to true. Boolean attribute (presence = true). |
| `check-url` (`checkUrl`) | `string` | no | `""` | no | Optional same-origin GET. `200` + JSON `{entitled: true}` sets `entitled`. Other statuses, network errors, and non-boolean `entitled` leave the property unchanged. Skipped when already entitled. |
| `redirect-to` (`redirectTo`) | `string` | no | `/pricing` | no | Blocked `<a href>` and `gate-blocked` `redirectTo`. Whitespace-only falls back to `/pricing`. |
| `auto-redirect` (`autoRedirect`) | `boolean` | no | `false` | no | After `gate-blocked`, `location.assign(redirectTo)` only when this is true **and** the event was not canceled (`cancelable: true`). Host should keep this false and navigate itself. |

## Events

Bubbling, composed `CustomEvent`s.

| Event | Detail | When |
|---|---|---|
| `gate-blocked` | `{redirectTo: string}` | The island is not entitled after connect (and after optional `check-url`). Also when `entitled` flips from true to false. **Cancelable.** Fired **before** any `location.assign`. |

`preventDefault()` on `gate-blocked` blocks auto-redirect. With `auto-redirect` false (default), the host listens and navigates; the island does not assign location.

## Methods

| Name | Args | Notes |
|---|---|---|
| `navigate` | `href: string` | `location.assign`. Called only when `auto-redirect` is true and `gate-blocked` was not canceled. Override to intercept (tests / host router). |

## Slots

| Slot | Required | Notes |
|---|---|---|
| default | no | Projected only when `entitled` is true. Light-DOM children remain in the host when blocked; they are not displayed. |

## CSS custom properties / `::part()`

Shadow DOM. Tokens from `mode-toggle/theme` (`toborKitTokens`, `toborKitControls`).

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-fg` | `#e8e9f0` | Text |
| `--tobor-kit-accent` | `#6ee7c7` | Upgrade link |
| `--tobor-kit-border` | `#2c2f3d` | Blocked panel border |
| `--tobor-kit-radius` | `12px` | Blocked panel radius |
| `--tobor-kit-gap` | `12px` | Blocked panel padding and gap |

| `::part()` | Node |
|---|---|
| `root` | Wrapper (`data-cy="gate.root"`) |
| `blocked` | Blocked panel (`data-cy="gate.blocked"`), only when not entitled |
| `link` | Upgrade `<a>` (`data-cy="gate.link"`), only when not entitled |

No styleguide classes. Do not pierce the shadow tree.

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix `gate`. No `data-testid` on this tag. Hooks live in Shadow DOM.

| Hook | Node |
|---|---|
| `gate.root` | Wrapper, both states |
| `gate.blocked` | Blocked message panel |
| `gate.link` | Upgrade link (`href` = resolved `redirect-to`) |

## Theming

Shadow DOM. Restyle with `--tobor-kit-*` on the host (or ancestors) and `noizu-subscription-gate::part(blocked)` / `::part(link)`. Light DOM is not used for chrome.
