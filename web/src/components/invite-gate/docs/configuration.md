# Configuration — noizu-invite-gate

## Attributes and properties

| Attribute / property | Default | Notes |
|---|---|---|
| `endpoint` | `/api/v1/invites/redeem` | Redeem URL. Resolved against the page; anything off-origin (or with credentials, or not http/https) is refused with the `failure` state and **no request**, so the code and Bearer token never leave the host. |
| `continue-url` | `/app` | Same-origin target after success. An off-origin value falls back to `/app`. To continue elsewhere, cancel `noizu-invite-redeemed` and navigate yourself. |
| `profile-url` / `settings-url` | `/app/profile` / `/app/settings` | Same-origin links. `""` or an off-origin value hides the link. |
| `sign-out-url` | `""` | Same-origin. Navigated after an uncanceled `noizu-invite-sign-out`. With no URL the button only emits the event. |
| `brand` | `""` | Product name used in the explanation. |
| `email` | `""` | Shown in the explanation when set. |
| `token` | `""` | Initial input value; changing it later replaces the input value. |
| `with-credentials` | `false` | `credentials: "include"` instead of `"same-origin"` (cookie session on a sibling subdomain). |
| `embedded` | `false` | Render the card without the centred full-page shell. |
| `accessToken` (property) | — | Adds `Authorization: Bearer …` to the redeem request. |
| `redeemer` (property) | — | `(token: string) => Promise<unknown>`. Replaces the built-in `fetch`. Reject with an `Error`; set `status` (number) on it so the right copy is chosen. |
| `text` (property) | `{}` | Copy overrides. Keys: `title createdPrefix createdSuffix inviteOnly brandFallback label placeholder submit working success profile settings signOut empty invalid expired used rateLimited unauthenticated failure`. |

## Error mapping

| Answer | `code` | Default copy |
|---|---|---|
| blank input (no request) | `empty` | enter your invite code. |
| 404, 400, 422, or "invalid" / "not found" | `invalid` | that invite code is invalid or expired. |
| 410, or "expired" without "invalid" | `expired` | that invite has expired — ask your team for a new one. |
| 409, or "already" / "exhausted" | `used` | that invite has already been used. |
| 429, or "too many" / "rate limit" | `rate_limited` | too many attempts — wait a minute and try again. |
| 401 | `unauthenticated` | your session has ended — sign in again. |
| anything else, network error | `failure` | something went wrong — try again. |

`classifyInviteRedeemError(status, message)` is exported for hosts that render their own UI.

## Events

- `noizu-invite-redeemed` `{result, continueUrl}` — cancelable; fires before navigation.
- `noizu-invite-error` `{code, status?, message}`.
- `noizu-invite-sign-out` `{url}` — cancelable; fires before navigation.

## Methods

- `redeem(token?: string): Promise<boolean>` — what the form submit calls.

## Slots and parts

Slots `brand` (above the title) and `footer` (below sign-out). Parts listed in the README.
CSS custom properties are the `--auth-*` set shared with `<noizu-auth>`: `--auth-color`,
`--auth-font`, `--auth-page-background`, `--auth-page-height`, `--auth-background`,
`--auth-border`, `--auth-radius`, `--auth-shadow`, `--auth-width`, `--auth-padding`,
`--auth-muted`, `--auth-accent`, `--auth-on-accent`, `--auth-link`, `--auth-error`,
`--auth-focus`, `--auth-input-background`, `--auth-field-radius`, `--auth-control-radius`,
`--auth-button-background`, `--auth-label-font`.

## `invite-required.js` helpers

Import from `@noizu/tobor-kit/invite-required` (or the CDN
`components/invite-gate/invite-required.js`). No element is registered.

| Export | Use |
|---|---|
| `handleInviteRequired(response, {url?, navigate?})` | `true` (and redirects) when `response` is the gate; reads a clone, so the body stays readable. |
| `withInviteGate(fetch?, {url?, navigate?})` | A `fetch` that redirects and rejects with `InviteRequiredError` on the gate. |
| `isInviteRequiredResponse(status, body, wwwAuthenticate?)` | The predicate: 403 with `{"error":"invite_required"}` or `WWW-Authenticate … scope="invite_required"` (MCP). |
| `userNeedsInvite(user)` | `user.invite_required` when boolean, else `status` is `pending`/`waitlist`. |
| `sameOriginUrl(url, fallback)` | The same-origin check the element uses. |
| `DEFAULT_INVITE_REQUIRED_URL`, `DEFAULT_INVITE_REDEEM_ENDPOINT`, `INVITE_OPTIONAL_HINT`, `INVITE_REQUIRED_ERROR` | Contract constants. |

The redirect helpers never navigate when the browser is already on the interstitial
path, so the interstitial's own 403s cannot loop.
