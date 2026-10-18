# noizu-plan-compare configuration

Tags in this family: `noizu-plan-compare`.

Data-driven pricing comparison. Properties down, one event up. The host owns Payment Links, redirects, and any Stripe session. This island carries no secrets.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `plans` | `Plan[]` (`json`) | no | `[]` | n/a | Property-only. Never an HTML attribute. When empty, a child `<script type="application/json">` (array or `{plans: [...]}`) is parsed. |
| `layout` | `"cards"` \| `"table"` | no | `cards` | yes | `cards` = grid. `table` = feature matrix. Other values render as cards. |
| `billing-toggle` (`billingToggle`) | boolean | no | `false` | yes | HTML attribute `billing-toggle`. When true, a monthly/yearly switch is shown and the displayed price follows the selected interval (default monthly). |
| `checkout-url-template` (`checkoutUrlTemplate`) | string | no | `""` | no | Host Payment Link (or equivalent) template. `{planId}` is replaced with the plan id. Empty template → `checkoutUrl` is `""`. |

`Plan` shape:

```ts
{
  id: string;
  name: string;
  priceMonthly: number | string;
  priceYearly: number | string;
  features: string[];
  ctaLabel?: string;
  highlighted?: boolean;
}
```

Numeric prices are formatted as USD (`$9/mo`, `$90/yr`). Strings are shown as-is (suffix added unless they already include `/mo` or `/yr`). Default CTA copy: `Choose plan`. `highlighted` adds a Popular badge and accent border.

## Events

| Name | Detail | When |
|---|---|---|
| `plan-select` | `{planId: string, checkoutUrl: string, interval: 'monthly' \| 'yearly'}` | A plan CTA is clicked. Bubbles, composed. |

`checkoutUrl` is `checkout-url-template` with `{planId}` interpolated. `interval` is `yearly` only when `billing-toggle` is on and the switch is yearly; otherwise `monthly`. The island does **not** navigate, does **not** open Stripe Checkout, and does **not** create sessions.

## Methods

None.

## Slots

None. The JSON `<script>` is a light-DOM data child, not a slot.

## CSS custom properties / `::part()`

Shadow DOM. Style through tokens on the host (or an ancestor); do not pierce.

| Token | Default |
|---|---|
| `--tobor-kit-font-family` | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--tobor-kit-bg` | `#12131a` |
| `--tobor-kit-surface` | `#1b1d27` |
| `--tobor-kit-fg` | `#e8e9f0` |
| `--tobor-kit-muted` | `#9aa0b4` |
| `--tobor-kit-accent` | `#6ee7c7` |
| `--tobor-kit-accent-fg` | `#08130f` |
| `--tobor-kit-border` | `#2c2f3d` |
| `--tobor-kit-danger` | `#ff6b6b` |
| `--tobor-kit-warn` | `#f5c451` |
| `--tobor-kit-radius` | `12px` |
| `--tobor-kit-gap` | `12px` |
| `--tobor-kit-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` |
| `--tobor-kit-duration` | `320ms` |
| `--tobor-kit-plan-min` | `16rem` |

Shared token sheet lives in `web/src/components/mode-toggle/theme.ts`.

| `::part()` | Node |
|---|---|
| `compare` | Root wrapper (`data-cy="plan.compare"`) |
| `toggle` | Billing interval switch |
| `card` | Plan card (`<article>`) or table column header |
| `name` | Plan name |
| `price` | Formatted price (`data-interval`, `data-amount`) |
| `features` | Feature list (cards layout) |
| `cta` | Select button |
| `table` | Comparison `<table>` |

## `data-cy` / `data-testid`

| Hook | Control |
|---|---|
| `plan.compare` | Root wrapper |
| `plan.card` | One per plan (card or table column) |
| `plan.toggle` | Monthly/yearly switch (`role="switch"`). Absent unless `billing-toggle`. |
| `plan.cta` | Plan CTA button (`data-plan-id`) |

No `data-testid` hooks. Prefix freeze: `plan`.

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Light-DOM class hooks are not part of this island. Highlighted plans use the accent token.
