# billing-status mirror (wave 1)

Mirror of `web/src/components/billing-status/noizu-billing-status.ts` —
contract class A (stateless render-only). Module:
`ToborKit.Hologram.Billing.Status`.

## Usage

```holo
<Billing.Status subscription={@subscription} target="page" />
```

Host state: `%{status => "past_due", plan_name => "Studio", trial_ends_at => iso, renews_at => iso}`
(string- or atom-keyed; snake_case preferred, camelCase accepted).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `subscription` | map | nil | host snapshot; never a Stripe object/secret |
| `target` | string | `parent` | portal-open dispatch target |
| `class` | string | `""` | extra root class |

Kind resolution: `complimentary` flag (or `status == "complimentary"`) wins,
then the raw status; empty snapshot renders "No subscription".
ISO timestamps collapse to `YYYY-MM-DD` for timezone-stable output.

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `portal-open` | `:portal_open` | — |

Host opens the Stripe customer portal. No Stripe in the mirror.

## Theming

`.tk-billing-status__*` classes under `.tk`; status coloring per kind
(`past_due` → danger, `trialing` → warn, `canceled` → muted).

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `billing.status` | status span (with `data-kind`) |
| `billing.plan` | plan span (only when plan name non-empty) |
| `billing.portal` | "Manage billing" button |

## Divergences from Lit

- `formatBillingDate` falls back to `Date.parse` for non-ISO strings; the
  mirror only rewrites `YYYY-MM-DD…`-prefixed values and passes anything
  else through. Hosts pass ISO timestamps.

Backend: None. Host owns the Stripe customer portal and billing data.
