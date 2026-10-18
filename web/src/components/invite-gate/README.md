# noizu-invite-gate

The invite interstitial for the "register open, app gated" pattern. Anyone can sign up;
an account whose email domain needs an invite is created **pending** and held here until
it redeems an invite code. The card explains why, takes the code, redeems it, and
continues into the app. Profile, settings and sign-out stay reachable.

The host owns the session, the route guard, the redeem endpoint and every redirect into
this page. The element calls the endpoint and emits events. It stores nothing.

The family also ships `invite-required.js`: framework-free helpers that turn any API
`403 {"error":"invite_required"}` into a redirect to the interstitial
(`handleInviteRequired`, `withInviteGate`, `userNeedsInvite`). It registers no element.

Contract source: monorepo `docs/invite-interstitial/PATTERN.md` (the therobotplans pilot).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/invite-gate/noizu-invite-gate.js"></script>

<!-- served at /auth/invite-required -->
<noizu-invite-gate brand="therobotplans" email="me@example.com" sign-out-url="/logout"></noizu-invite-gate>
```

```ts
import '@noizu/tobor-kit/invite-gate';
import {withInviteGate} from '@noizu/tobor-kit/invite-required';

// Every API call: a 403 invite_required sends the browser to the interstitial.
const apiFetch = withInviteGate(fetch);
```

Pair with `<noizu-auth invite-token-mode="optional">` on the signup form (see the auth
family README): the invite field becomes optional with a hint, and a held signup routes here.

Full options: [docs/configuration.md](docs/configuration.md). Host API: [docs/backend-requirements.md](docs/backend-requirements.md). Mount snippets: [examples/README.md](examples/README.md).

## Properties / attributes

| Name | Type | Default | Description |
|---|---|---|---|
| `endpoint` | String | `/api/v1/invites/redeem` | `POST {"token"}`. Same-origin only; an off-origin value is refused without a request. |
| `continue-url` | String | `/app` | Navigated after an uncanceled `noizu-invite-redeemed`. Same-origin only. |
| `profile-url` | String | `/app/profile` | Profile link. Empty hides it. |
| `settings-url` | String | `/app/settings` | Settings link. Empty hides it. |
| `sign-out-url` | String | `""` | Navigated after an uncanceled `noizu-invite-sign-out`. Empty = event only. |
| `brand` | String | `""` | Product name in the copy ("… is invite-only right now"). Falls back to "this app". |
| `email` | String | `""` | Signed-in email shown in the explanation. |
| `token` | String | `""` | Prefills the code input (e.g. from an invite link). |
| `with-credentials` | Boolean | `false` | `credentials: "include"` on the redeem request (default `same-origin`). |
| `embedded` | Boolean | `false` | Card only, no full-page shell. |
| `accessToken` | String (property) | — | Bearer token for REST hosts. Never an attribute. |
| `redeemer` | `(token) => Promise` (property) | — | Host-performed redeem; the element then makes no request. Reject with an `Error` carrying `status` when known. |
| `text` | Object (property) | `{}` | Copy overrides (`title`, `label`, `submit`, `invalid`, `used`, …). |

## Events

| Event | Detail | Cancelable | Fired when |
|---|---|---|---|
| `noizu-invite-redeemed` | `{result, continueUrl}` | yes | Redeem succeeded. Cancel to route yourself (e.g. refresh the session first). The form stays disabled either way: the invite is consumed, so a retry could only 409. |
| `noizu-invite-error` | `{code, status?, message}` | no | Redeem failed. `code`: `empty` `invalid` `expired` `used` `rate_limited` `unauthenticated` `failure`. |
| `noizu-invite-sign-out` | `{url}` | yes | Sign-out clicked. Clear your session here. |

## Methods

| Name | Notes |
|---|---|
| `redeem(token?)` | Redeems `token` (default: the input). Resolves `true` on success. |

## data-cy

`invite-required` `invite-title` `invite-description` `invite-redeem-form` `invite-code-input`
`invite-redeem-submit` `invite-error` `invite-status` `invite-profile-link` `invite-settings-link`
`invite-sign-out` (the same hooks as the pilot page, so app Cypress suites keep working).

## Accessibility

The input has a visible `<label>` and takes focus on mount and after every failure. The
error is a `role="alert"` region tied to the input with `aria-describedby`, and the input
gets `aria-invalid="true"`. Progress and success are announced in a polite `role="status"`.

## Theming

Uses the same `--auth-*` tokens as `<noizu-auth>`, so a themed sign-in card and the
interstitial match. Parts: `shell card title description email form label input submit
error status links link profile-link settings-link sign-out`. Slots: `brand`, `footer`.
