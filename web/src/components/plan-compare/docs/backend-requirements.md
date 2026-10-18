# Backend requirements — plan-compare family

**None required.**

`<noizu-plan-compare>` is a browser island. It renders host-supplied plan rows and emits `plan-select`. There is no kit HTTP API, WebSocket, cookie header, or production tree (`elixir/`, `go/`, `backend/`) for this family.

## What the component does not do

- Create Stripe Checkout Sessions or Payment Intents
- Call Stripe, store Stripe secret/publishable keys, or embed Stripe.js
- Navigate or redirect (including `location.assign` to a Payment Link)
- Set cookies, CSRF, or authentication
- Carry secrets or tokens

## Host contract

The host supplies plans (`plans` property or child `<script type="application/json">`) and a `checkout-url-template` whose `{planId}` placeholder maps to a **host-owned** Stripe Payment Link (or equivalent). On `plan-select` the host navigates:

```js
el.addEventListener('plan-select', (event) => {
  const {checkoutUrl} = event.detail;
  if (checkoutUrl) location.assign(checkoutUrl);
});
```

| Channel | Name | Detail |
|---|---|---|
| element (bubbles, composed) | `plan-select` | `{planId, checkoutUrl, interval}` |

`interval` is `'monthly' | 'yearly'`. `checkoutUrl` is the interpolated template (empty string when the template is unset).

## Examples vs production

`examples/html|js|ts` mount the tag. `examples/{elixir,go,python,rust}` **serve a page with sample plans JSON**. They do not create Stripe sessions and they do not call Stripe. Optional on-page logging of `plan-select` is host-owned, not a kit API.

No auth. Production hosts own Payment Links, redirects, and any post-checkout verification.
