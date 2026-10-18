# noizu-plan-compare

Pricing comparison island. Properties down, one event up: `plan-select`. The host owns Stripe Payment Links and navigation. The island never checkouts and never carries Stripe keys.

Full options: [docs/configuration.md](docs/configuration.md). Backend: [docs/backend-requirements.md](docs/backend-requirements.md) (none). Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/plan-compare/noizu-plan-compare.js"></script>

<noizu-plan-compare
  layout="cards"
  billing-toggle
  checkout-url-template="https://example.com/checkout/{planId}"
>
  <script type="application/json">
    [
      {"id":"starter","name":"Starter","priceMonthly":9,"priceYearly":90,"features":["1 seat"]},
      {"id":"pro","name":"Pro","priceMonthly":29,"priceYearly":290,"features":["5 seats"],"highlighted":true}
    ]
  </script>
</noizu-plan-compare>
```

`plans` may also be set as a JS property (`el.plans = [...]`). The property wins when non-empty.

On `plan-select`, the host navigates to `detail.checkoutUrl` (interpolated `{planId}`). Do not create Stripe sessions in the kit.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `plans` | `Plan[]` | no | `[]` | Property-only. Child JSON script used when empty. |
| `layout` | `"cards"` \| `"table"` | no | `cards` | Card grid or comparison table |
| `billing-toggle` | Boolean | no | `false` | Monthly/yearly switch |
| `checkout-url-template` | String | no | `""` | Host URL with `{planId}` |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `plan-select` | `{planId, checkoutUrl, interval}` | CTA click |

## data-cy

`plan.compare`, `plan.card`, `plan.toggle`, `plan.cta`

## Theming

Shadow DOM. Consumes shared `--tobor-kit-*` tokens (`theme.ts`). Card min-width: `--tobor-kit-plan-min` (default `16rem`).
