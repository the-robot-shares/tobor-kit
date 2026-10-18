# Backend requirements — noizu-billing-status

**None required.**

`<noizu-billing-status>` does not call a server, Stripe, or any kit route. The **host** supplies a subscription snapshot as the `subscription` JS property and owns the customer portal. There is no production tree in `elixir/`, `go/`, or `backend/` for this island.

## Subscription snapshot

Set `el.subscription` (property-only). Typical host source: the host's own billing API after a server-side Stripe (or equivalent) read. The element never fetches.

```json
{
  "status": "active",
  "planName": "Pro",
  "renewsAt": "2026-10-01T00:00:00.000Z",
  "trialEndsAt": null,
  "complimentary": false
}
```

| Field | Host meaning |
|---|---|
| `status` | `active` \| `trialing` \| `past_due` \| `canceled` \| `complimentary` \| other string |
| `trialEndsAt` / `renewsAt` | ISO date or datetime strings the island formats as `YYYY-MM-DD` |
| `complimentary` | Host flag; when true the label is Complimentary |
| `planName` | Display name |

Do **not** put Stripe customer ids, price ids, API keys, or session cookies on the element.

## Auth

None on the element. If the host page is behind a session, that session stays on the host (`credentials: 'same-origin'` on **host** `fetch`, never from the island).

## Host-owned portal

The island emits `portal-open` `{}` (bubbles, composed). The **host** creates a Stripe Billing Portal session and redirects. The element does **not** redirect, `Set-Cookie`, take payment, or hold a Stripe secret.

Optional echo used in `examples/{elixir,go,python,rust}/` (not a kit API, not Stripe):

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `POST` | `/billing/portal` | empty / `{}` | `200` `{url: string}` | `401` unauthenticated, `502` provider failure |

Page JS then `location.assign(url)`. Production hosts call Stripe `billingPortal.sessions.create` **on the server** and return that URL. Never embed `sk_…` / webhook secrets in snippets or attributes.

## What the component does not do

- Talk to Stripe (Customers, Subscriptions, Billing Portal, Checkout)
- `Set-Cookie`, CSRF, JWT, or `credentials: 'include'`
- Redirects or payment
- Server-side verification of subscription state
- Store or refresh the snapshot

## Examples vs production

| Tree | Role |
|---|---|
| Host billing API + Stripe secret on the **host** | Production snapshot + portal session |
| `examples/html`, `examples/js`, `examples/ts` | Mount the tag, set `.subscription`, listen for `portal-open` |
| `examples/{elixir,go,python,rust}` | Serve the page and stub `POST /billing/portal` |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
