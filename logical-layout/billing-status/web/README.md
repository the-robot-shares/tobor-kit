# noizu-billing-status

Shadow-DOM status row for a host-owned subscription snapshot. Clicking **Manage billing** emits `portal-open`; the host opens the Stripe customer portal. The element never talks to Stripe and carries no secrets.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/billing-status/noizu-billing-status.js"></script>

<noizu-billing-status></noizu-billing-status>
<script type="module">
  const el = document.querySelector('noizu-billing-status');
  el.subscription = {status: 'active', planName: 'Pro', renewsAt: '2026-10-01'};
  el.addEventListener('portal-open', () => {
    // Host-owned: create a Billing Portal session and redirect. No Stripe in the element.
  });
</script>
```

`subscription` is a JS property (`propertyOnly`) — never an HTML attribute.

Full options: [docs/configuration.md](docs/configuration.md). Host contract: [docs/backend-requirements.md](docs/backend-requirements.md). Mount snippets: [examples/README.md](examples/README.md).

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `subscription` | Object | no | — | `{status, trialEndsAt?, renewsAt?, complimentary?, planName?}`. Property-only. |

`status`: `active` \| `trialing` \| `past_due` \| `canceled` \| `complimentary` \| string.

## Events

| Event | Detail | Fired when |
|---|---|---|
| `portal-open` | `{}` | Manage billing is clicked |

## data-cy

`billing.status` `billing.plan` `billing.portal`

## Theming

Shadow DOM — restyle through `--tobor-kit-*` tokens and `::part(row|status|plan|dates|portal)`.
