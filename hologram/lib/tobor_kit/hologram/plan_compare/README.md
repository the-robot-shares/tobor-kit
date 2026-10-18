# Plan compare (Hologram mirror)

Port of `web/src/components/plan-compare/noizu-plan-compare.ts` (Lit) →
`ToborKit.Hologram.PlanCompare.Compare`.

## Usage

```elixir
<Compare
  cid="my-plans"
  plans={@plans}
  layout="cards"
  billing_toggle={true}
  checkout_url_template={@checkout_template}
  target="page"
/>
```

`cid` is required. `layout` clamps to `cards | table` (default `cards`).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `plans` | list of string-keyed maps or `Data.Plans` structs | `[]` | rows without `id`/`name` are dropped |
| `layout` | string | `"cards"` | `cards` or `table` |
| `billing_toggle` | boolean | `false` | monthly/yearly toggle |
| `checkout_url_template` | string | `""` | interpolated via `Data.Plans.interpolate_checkout_url/2` in `init/3` |
| `target` | string | `"parent"` | action dispatch target |

Plan fields: `id`, `name`, `priceMonthly`, `priceYearly` (number or display
string), `features` (string list), `ctaLabel`, `highlighted`. Price displays,
`data-amount` strings, checkout URLs and the table feature matrix are all
precomputed server-side; client re-renders touch state only.

## Event contract

| Lit `CustomEvent` | Hologram action | Params |
|---|---|---|
| `plan-select` | `:plan_select` | `%{plan_id, checkout_url, interval}` |

CTAs render as `<a href={checkout_url}>` — **the host owns navigation**; the
click action only reports the selection.

## Theming

Scoped under `.tk-plan-compare` (cards grid, highlighted card/badge/CTA, table
with feature matrix). Family public token:

- `--tobor-kit-plan-min` — min card width for the auto-fit grid (default `16rem`).

## data-cy

| Hook | Element |
|---|---|
| `plan.compare` | root |
| `plan.card` | each card |
| `plan.toggle` | billing toggle |
| `plan.cta` | each CTA link |

## Divergences

- Billing toggle interval switches re-render from state; the Lit source
  recomputed prices client-side, the mirror precomputes both intervals in
  `init/3`.

## Backend

None. Host owns checkout navigation and subscription state — the mirror only
reports the selection.
