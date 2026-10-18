# Configuration — noizu-billing-status

Tags in this family: **`noizu-billing-status`**.

Shadow-DOM island. The host injects a subscription snapshot as a JS property and owns the Stripe customer portal. The element carries no secrets and does not call Stripe.

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Properties / attributes

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `subscription` | `BillingSubscription` (object) | no | — | no | **Property-only** (`attribute: false`). Never serialized as an HTML attribute. |

`BillingSubscription`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | `'active' \| 'trialing' \| 'past_due' \| 'canceled' \| 'complimentary' \| string` | yes (when snapshot is set) | Unknown strings are shown title-cased with `_` → space. |
| `trialEndsAt` | `string` | no | ISO date or datetime. Rendered as `Trial ends YYYY-MM-DD`. |
| `renewsAt` | `string` | no | ISO date or datetime. Rendered as `Renews YYYY-MM-DD`. |
| `complimentary` | `boolean` | no | When `true`, label is **Complimentary** even if `status` is `active`. |
| `planName` | `string` | no | Shown on `billing.plan` when nonempty. |

Empty / omitted `subscription` renders **No subscription** and still offers **Manage billing**.

Label map: `active` → Active, `trialing` → Trialing, `past_due` → Past due, `canceled` → Canceled, `complimentary` → Complimentary.

## Events

Bubbling, composed `CustomEvent`s via kit `emit()`.

| Event | Detail | When |
|---|---|---|
| `portal-open` | `{}` | **Manage billing** clicked. Host opens the Stripe customer portal (session create + redirect). |

## Methods

None beyond `HTMLElement` / Lit lifecycle.

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Tokens from `mode-toggle/theme` (`toborKitTokens`, `toborKitControls`).

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-fg` | `#e8e9f0` | Status text |
| `--tobor-kit-muted` | `#9aa0b4` | Plan, dates, canceled |
| `--tobor-kit-accent` | `#6ee7c7` | Button hover / focus |
| `--tobor-kit-accent-fg` | `#08130f` | Pressed control foreground |
| `--tobor-kit-border` | `#2c2f3d` | Button border |
| `--tobor-kit-danger` | `#ff6b6b` | `past_due` |
| `--tobor-kit-warn` | `#f5c451` | `trialing` |
| `--tobor-kit-radius` | `12px` | Button radius |
| `--tobor-kit-gap` | `12px` | Row gap |
| `--tobor-kit-font-family` | system UI stack | Font |

| `::part()` | On |
|---|---|
| `row` | Flex status row |
| `status` | Status label |
| `plan` | Plan name (omitted when empty) |
| `dates` | Optional trial/renew copy |
| `portal` | Manage billing button |

No Light-DOM class hooks.

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix `billing`. No `data-testid` on this tag. Hooks live in Shadow DOM.

| Hook | Node |
|---|---|
| `billing.status` | Status label (`data-kind` is the resolved kind) |
| `billing.plan` | Plan name, only when `planName` is nonempty |
| `billing.portal` | Manage billing `<button type="button">` |

## Theming

Shadow DOM — restyle through the `--tobor-kit-*` tokens and `::part(...)`. Do not pierce the shadow tree. Light DOM is not used.
