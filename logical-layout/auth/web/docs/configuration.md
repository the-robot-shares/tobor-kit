# `noizu-auth` configuration

Family tag: **`noizu-auth`**. Usage summary: [README.md](../README.md). This file is the full options surface.

The element is a UI island. Hosts own redirects, session cookies, and server-side verification. **No secrets in the element.**

## Tags

| Tag | File |
|-----|------|
| `noizu-auth` | `noizu-auth.ts` |

## Properties / attributes

`options`, `text`, and `avatar` are object **properties**, not serialized HTML attributes.

| Name | Type | Required | Default | Reflect | Notes |
|------|------|----------|---------|---------|-------|
| `mode` | `'interstitial' \| 'modal' \| 'dropdown'` | no | `'interstitial'` | yes | Native `<dialog>` when `modal`; anchored non-modal popover when `dropdown`. |
| `flow` | `'login' \| 'signup'` | no | `'login'` | yes | Signup uses profile fields after email discovery. Toggling flow while `mode="dropdown"` switches to `modal` for signup and back to `dropdown` for login (per spec: signup uses modal, login uses dropdown — both are modes of the same component). |
| `invite-token-mode` (`inviteTokenMode`) | `'optional' \| 'required' \| 'hidden'` | no | `'optional'` | yes | Signup invite-token policy. Invalid values resolve to `'optional'` (the attribute itself is preserved). `required` adds client-side validation only — the server stays authoritative (see [backend requirements](./backend-requirements.md)). `hidden` removes the field and the `invite_token` register param. `text.invite` overrides the mode-derived label (`"Invite token (optional)"` / `"Invite token (required)"`) in every rendering mode. |
| `invite-required-url` (`inviteRequiredUrl`) | `string` | no | `'/auth/invite-required'` | no | Invite interstitial route, used only when `invite-token-mode="optional"` is set **explicitly** (attribute or property). A `register` answered with `invite_required` (the `invite_required` error code — message prose is never matched — or a success whose `user` / `session.user` has `invite_required: true` or a `pending`/`waitlist` status) emits the cancelable `noizu-auth-invite-required` and navigates here; no error block is rendered. On a success `auth-success` fires first. Same-origin only; `''` or an off-origin value turns routing off (the legacy error shows). |
| `open` | `boolean` | no | `false` | yes | Opens the modal or dropdown. Ignored for interstitial. |
| `endpoint` | `string` | no | `'/auth/socket'` | no | Socket transport only. Same-host absolute path (`/…`). Not a foreign URL, protocol-relative URL, or `\\` path. |
| `transport` | `'socket' \| 'rest'` | no | unset (= `socket`) | yes | Selects the wire protocol. Unset preserves today's WebSocket behaviour exactly. See [Transports](#transports). |
| `api-base` (`apiBase`) | `string` | no | `'/api/v1'` | no | REST transport only. Same-origin absolute path for the JSON auth API. Foreign origins, query strings and credentials in the URL are refused. |
| `with-credentials` (`withCredentials`) | `boolean` | no | `false` | no | REST transport only. `false` → `credentials: "omit"`. Enable only for a cookie-session REST backend with its own CSRF defence. |
| `development` | `boolean` | no | `false` | no | Must be true before `dev-port`. |
| `dev-port` (`devPort`) | `number` | no | unset | no | Integer 1–65535. Same host and scheme; only the port changes. |
| `options` | `AuthOptions` | no | `{password: true, magicLink: false, otp: false, signup: true}` | no | `propertyOnly`. UI allowlist for the **legacy** email flow (used when `pipes` is unset). Backend must enforce. |
| `text` | `AuthText` | no | `{}` | no | `propertyOnly`. Partial labels from exported `AuthText`, including the new pipe/merge/trigger labels. |
| `avatar` | `AuthAvatar` | no | unset | no | `propertyOnly`. `{src, alt}`. `alt` required; `""` is decorative. |
| `pipes` | `AuthPipeConfig[]` | no | unset | no | `propertyOnly`. Data-driven pipe allowlist (see below). Undefined preserves the legacy `options`-driven flow unchanged. |
| `custom-method` (`customMethod`) | `boolean` | no | `false` | yes | Host-provided sign-in. Renders the `method-*` slots in place of every built-in pipe and makes no network request. `pipes = ['custom']` is equivalent. See [Custom method](#custom-method). |
| `sms-regions` (`smsRegions`) | `AuthSmsRegions` | no | unset | no | `propertyOnly`. SMS-region allowlist for the mobile pipes (see below). Undefined disables all region gating — additive, backwards compatible. |

`AuthOptions`: `password?`, `magicLink?`, `otp?`, `signup?`, `providers?: string[]`. Omitted `password` / `signup` default on; `magicLink` / `otp` require `true`. Omitted `providers` shows every server-advertised provider; `[]` hides all. Client options never authorize.

### `pipes` (six-pipe, data-driven)

`AuthPipeConfig = AuthPipeId | {id: AuthPipeId; label?: string}`, where `AuthPipeId` is one of:

`email_password` · `mobile_password` · `email_otp` · `mobile_otp` · `google` · `authentik` · `github`

### Custom method

`custom-method` (or `pipes = ['custom']`) keeps the card chrome — `brand` / `avatar` / `footer` slots, per-flow title, close ×, the `interstitial` / `modal` / `dropdown` shells, focus trapping, Escape, `auth-close`, `open`, `flow` — and replaces everything between the title and the footer with a host-slotted pane:

| Flow | Slot used | Fallback |
|------|-----------|----------|
| `login` | `method-login` | `method` |
| `signup` | `method-signup`, then `method-register` | `method` |

- **No network.** No `/auth/config`, no transport, on either `transport` value. Turning the mode off again loads discovery as usual.
- **No human verification.** Nothing mounts `<noizu-human-verify>` in this mode; `noizu-auth` never imports that element in any mode. Anti-abuse is the host's server-side concern.
- **Finishing the flow:** `complete(detail)` fires `auth-success` (and `noizu-auth-success`) with `detail` exactly as passed, then closes a modal or dropdown (which fires `auth-close`). `fail(error)` takes a string, an `Error` or `{message, code?}`, renders the message in the `auth-error` region and fires `auth-error` (and `noizu-auth-error`) with `{message, code?}`; the surface stays open.
- **Switching panes:** dispatch a bubbling `auth-flow-switch` event with `{flow: 'login' | 'signup' | 'register'}` from slotted content, or set `flow`. `register` is an alias of `signup`.
- **Copy:** `text.loginTitle` / `text.signupTitle` title the card per flow. The subtitle renders only when `text.description` is set. The footer's opposite-flow link stays unless `options.signup` is `false`.
- **Focus:** opening lands on the first focusable control in the current pane.

### `layout`

`console` (the default) or `tabs`. The console is the portfolio-standard arrangement — social providers as icon buttons, an `or` rule, an `email | mobile` segmented toggle when both password pipes are enabled, the credential form, the one-time-code pipes as text links, and a footer offering the opposite flow. Each section renders only when the pipes behind it are enabled. `tabs` restores the original flat row of pipe buttons and is the opt-out for a host that built around it.

The console covers the legacy `options` flow as well as the `pipes` surface. Domain routing is unchanged there: at the `sso` step only the matched providers render and there is no credential form. What changed is that configured providers now appear from the first step rather than only after a policy matched.

New parts: `sso-button`, `provider-icon`, `divider`, `segments`, `segment`, `otp-links`, `otp-link`, `console-foot`, `providers-unavailable`. New tokens: `--auth-control-radius`, `--auth-field-radius`, `--auth-label-font`, `--auth-link`. New `text` keys: `chooseMethod`, `or`, `identifierType`, `segmentEmail`, `segmentMobile`, `emailCodeLink`, `mobileCodeLink`, `getStarted`, `logInLink`, `providersUnavailable`, `consoleBack`.

Setting `pipes` (a non-empty array) switches the element from the legacy `options`-driven email flow to a pipe selector + per-pipe form. The host declares which pipes are enabled and in what order they should be considered — the component always renders them in the canonical order above regardless of array order, and never hardcodes a fixed list; unset/omitted pipes are simply not offered. `mobile_password` / `mobile_otp` render a `<noizu-phone-input>` for the identifier. `google` / `authentik` / `github` render a single redirect button that resolves against `config.providers` (matching `id: "google"` / `id: "authentik"` / `id: "github"`) — same SSO mechanism as the legacy flow, just presented as a pipe. A pipe with no matching provider renders disabled with the `unavailable` copy.

```js
auth.pipes = ['email_password', 'mobile_otp', 'google'];
```

### Merge-flow states

Exposed only through events and rendered markup — there is no public state property. States: `idle` → `collecting` → (`otp_sent`)? → `success` | `error`, or `collecting` → `merge_required` → `merge_confirming` → `success`.

`merge_required`: the backend returned `{merge_required: true, challenge_id, pipes: [{type, masked}]}` from `login` / `register` / `otp-verify`. `masked` is **always** a masked identifier (e.g. `g****@gmail.com`) — the component never renders, stores, or assumes an unmasked one. The user picks one of the listed existing pipes to confirm the merge.

`merge_confirming`: a minimal form (or SSO redirect) for the chosen existing pipe type. The user must authenticate through it; the request carries `merge_challenge_id`. Until the backend confirms (`merge_confirmed: true` or `authenticated: true` on that confirming request), the new pipe is **not** active and **no session exists** — the component does not optimistically show success.

### `smsRegions` (SMS-region gating)

`AuthSmsRegions = {supported: string[]; message?: string}`. `supported` is a list of ISO-3166 alpha-2 country codes — the same vocabulary as `<noizu-phone-input>`'s `country` property and `country-change` event detail; the component derives the current region from that event, never from a second country table. Leaving `smsRegions` unset disables all gating and reproduces today's behavior exactly (additive, backwards compatible).

```js
auth.smsRegions = {
  supported: ['US', 'CA', 'GB'],
  message: 'Texting is not available in your region yet — try email instead.',
};
```

When set and the user's mobile pipe (`mobile_password` / `mobile_otp`) identifier resolves to a region **not** in `supported`:

- An inline notice renders next to the phone input (default copy: `text.smsRegionUnsupported`, `"SMS is not currently available for this region."`; override per-instance with `smsRegions.message`).
- The submit control for that pipe becomes `aria-disabled="true"` — it stays focusable and announced as disabled to assistive tech (native `disabled` would drop it from the tab order, which fails the requirement that keyboard users can reach and understand why it's unavailable). `submitPipe` also refuses to call the server while the region is unsupported.
- The pipe itself is **not** hidden or removed from the selector — the user can still see and select it, they just can't submit it for an unsupported region.
- Every other pipe (`email_password`, `email_otp`, `google`, `authentik`, `github`) is completely unaffected.

The notice is associated with the phone input via `aria-describedby`, wired through `<noizu-phone-input>`'s `described-by` property (see that family's docs) — `aria-describedby` set directly on the `<noizu-phone-input>` host tag cannot reach across into its own inner shadow DOM, so the element forwards it onto its internal `<input>` itself.

**The server is authoritative.** The client-side check above is UX only. If a submit reaches the backend and it replies with `error.code: "sms_region_unsupported"` (this element's WebSocket-transport analogue of an HTTP 422 — see `docs/backend-requirements.md`), the component renders **that server message** in the same inline slot — overriding the client-side default/override copy — even if `smsRegions` was unset or stale. This also fires `noizu-auth-sms-region-unsupported` `{pipe, message}` for host telemetry. Changing the phone's country afterward clears the server-side block so the next submit gets a fresh check.

## Transports

| `transport` | Wire | Session | Endpoints |
|---|---|---|---|
| unset / `socket` (**default**) | `wss://<host>{endpoint}` JSON-RPC-ish frames | Host cookie via `/auth/session/finish` handoff. Element sees no token. | `config`, `login`, `register`, `magic-link`, `otp-request`, `otp-verify` |
| `rest` | `fetch` against `{apiBase}` | **Bearer tokens** in the response body, emitted on `auth-success` / `noizu-auth-success` | `POST /auth/login`, `POST /auth/register`, `POST /auth/otp/{mobile,email}/start`, `POST /auth/otp/{mobile,email}/verify`, `POST /auth/mobile/register`, `POST /auth/mobile/login`, `GET /auth/merge/:challenge_id`, `POST /auth/merge/confirm`, optional `GET /auth/config` |

Both implement one internal contract (`AuthTransport` in `transport.ts`): `request(method, params)` resolving to a normalized result and rejecting with `AuthRequestError {message, code}`. The state machine, rendered markup, `data-cy` hooks and events are identical either way — only the wire differs.

### Session and token storage (REST)

The REST backend returns `access_token` / `refresh_token`. The element normalizes them into

```ts
{tokenType: 'Bearer', accessToken, refreshToken, expiresIn, user, organizations}
```

and emits it as `event.detail.session` on `auth-success` and `noizu-auth-success`. **The element never writes it to `localStorage`, `sessionStorage`, IndexedDB, or a cookie.** Where a token lives is a security decision with application-specific trade-offs (XSS blast radius, tab scope, refresh rotation, logout semantics); a reusable island must not make it on the host's behalf. On the socket transport the detail is `{}` — the session is a host cookie the element cannot and must not read.

### Credentials and CSRF (REST)

`credentials: "omit"` by default. A Bearer API needs no ambient cookie; sending one would make an unauthenticated `POST /auth/login` from any origin carry the victim's session, which the server cannot distinguish from a first-party call — classic login CSRF, plus the CORS-credentialed-request constraints that come with it. `with-credentials` opts back in for hosts whose REST auth really is cookie-session based; those hosts must supply their own CSRF token handling, which this element does not do.

### Error normalization

| Condition | Socket | REST | Element sees |
|---|---|---|---|
| Merge challenge | `{merge_required: true, challenge_id, pipes: [{type, masked}]}` | `409 {"status":"merge_required","merge_challenge_id","available_pipes":[{pipe, identifier}]}` | the same `merge_required` state; backend pipe names (`password_email`, `otp_mobile`) are translated to element pipe ids (`email_password`, `mobile_otp`), identifiers stay masked |
| Region not SMS-deliverable | `error.code: "sms_region_unsupported"` | `422 {"error":"sms_region_unsupported"}` | inline region notice + `noizu-auth-sms-region-unsupported` |
| Anything else | `error.{code,message}` | `{"error":"<code>"}` + status; unknown/non-JSON bodies fall back to `http_<status>` | `AuthRequestError {message, code}` → `auth-error` banner |

REST bodies carry a code and no prose, so the transport supplies public copy per known code (`invalid_credentials`, `invalid_code`, `expired_code`, `too_many_attempts`, `rate_limited`, `pipe_not_permitted`, `merge_not_authorized`, `not_found`, `invalid_identifier`, `invalid_password`, `sms_region_unsupported`). A server-supplied `message` wins when present. Network failures and timeouts become `network_error` / `timeout` — the same banner a dropped socket produces.

`magic-link` has no REST equivalent and rejects with `unsupported_method` without touching the network.

## Events

All bubble and are composed (cross the shadow boundary). Payloads never include passwords, tokens, or user secrets.

| Name | Detail | When |
|------|--------|------|
| `auth-success` | `{session?: AuthSession}` | Socket transport: `{}` — result `{authenticated: true}` for a session the host already completed; not a substitute for password validation. REST transport: `{session}` with the Bearer tokens for the host to store. |
| `auth-error` | `{message: string}` | Public failure copy from the socket or a rejected redirect. |
| `auth-close` | `{}` | Modal or dropdown dismissed (close control, Escape, outside click, or `open` cleared). |
| `auth-redirect` | `{url: string}` | Same-origin HTTP(S) handoff or provider `href`, immediately before `location.assign`. |
| `noizu-auth-submit` | `{pipe: string, flow: 'login' \| 'signup'}` | A pipe form (or SSO redirect) was submitted. `pipes` mode only. Additive — does not replace any existing event. |
| `noizu-auth-success` | `{session?: AuthSession}` | Fired alongside `auth-success` in `pipes` mode, with the identical payload. |
| `noizu-auth-error` | `{message: string}` | Fired alongside `auth-error` in `pipes` mode. Same semantics. |
| `noizu-auth-merge-required` | `{challengeId: string, pipes: Array<{type: string, masked: string}>}` | The identifier already belongs to an account. `masked` is always masked; never an unmasked identifier. |
| `noizu-auth-merge-confirmed` | `{challengeId?: string}` | The user authenticated via an existing pipe and the backend confirmed the merge. Only after this does the new pipe become active. |
| `noizu-auth-otp-requested` | `{pipe: string}` | An OTP code was requested for `email_otp` / `mobile_otp`; the form now shows the code field. |
| `noizu-auth-flow-change` | `{flow: 'login' \| 'signup'}` | `custom-method` only. The flow changed (footer link, `auth-flow-switch`, or the `flow` property). |
| `noizu-auth-sms-region-unsupported` | `{pipe: string, message: string}` | The server rejected a mobile-pipe submit with `error.code: "sms_region_unsupported"`. `smsRegions`/`pipes` mode only. |
| `noizu-auth-invite-required` | `{url: string, source: 'register' \| 'register-error'}` | Explicit `invite-token-mode="optional"` only: a signup was held for an invite. After `auth-success` (when the account was created), before navigating to `invite-required-url`. Cancelable. |

### Inbound event

| Name | Detail | Effect |
|------|--------|--------|
| `auth-flow-switch` | `{flow: 'login' \| 'signup' \| 'register'}` | Dispatched by slotted content (must bubble). `custom-method` only: switches `flow`; `register` means `signup`. Ignored in other modes. |

## Methods

| Method | Effect |
|--------|--------|
| `complete(detail = {})` | Fires `auth-success` and `noizu-auth-success` with `detail` unchanged, clears the error, and closes a modal or dropdown (`auth-close` follows). Intended for `custom-method`. |
| `fail(error)` | `error`: `string \| Error \| {message?, code?}`. Shows the message in the `auth-error` region and fires `auth-error` / `noizu-auth-error` with `{message, code?}`. Does not close. |

Everything else is driven with attributes, object properties, and events.

## Slots

| Slot | Role |
|------|------|
| `avatar` | Decorative figure outside the card. Keep controls out of this slot. |
| `brand` | Product name / mark above the title. |
| `footer` | Extra footer content beside the login/signup toggle. |
| `method` | `custom-method` only. Host sign-in content for both flows; the fallback for the two below. |
| `method-login` | `custom-method` only. Pane shown while `flow="login"`. |
| `method-signup` / `method-register` | `custom-method` only. Pane shown while `flow="signup"` (`method-signup` wins if both are present). |
| `trigger` | `mode="dropdown"` only. Replaces the internal default trigger button. The slotted element becomes the anchor: the component wires its click to toggle open/closed and manages `aria-expanded`/`aria-controls` and focus return on it directly. |

## CSS custom properties

| Token | Default |
|-------|---------|
| `--auth-color` | `#20232c` |
| `--auth-font` | `system-ui, sans-serif` |
| `--auth-background` | `#fff` |
| `--auth-page-background` | `#f5f6f8` |
| `--auth-page-height` | `100dvh` |
| `--auth-width` | `26rem` |
| `--auth-padding` | `2rem` |
| `--auth-border` | `#dddfe5` (inputs fall back to `#b8bdc7` unless overridden) |
| `--auth-radius` | `1rem` |
| `--auth-shadow` | `0 12px 40px #0001` |
| `--auth-muted` | `#606575` |
| `--auth-input-background` | `#fff` |
| `--auth-button-background` | `#fff` |
| `--auth-accent` | `#3759bb` |
| `--auth-on-accent` | `#fff` |
| `--auth-focus` | `#567ded` |
| `--auth-error` | `#a4262c` |
| `--auth-backdrop` | `#12172399` |
| `--auth-avatar-size` | `7rem` |
| `--auth-avatar-right` | `-1rem` |
| `--auth-avatar-top` | `-4rem` |
| `--auth-sms-region-color` | `#8a5a00` |

## `::part()` names

`shell`, `dialog`, `card`, `content`, `avatar`, `brand`, `title`, `description`, `providers`, `provider`, `methods`, `method` (a legacy method button, or the custom-method pane wrapper), `form`, `field-group`, `field-label`, `field-input`, `button`, `submit`, `close`, `back`, `flow-toggle`, `status`, `error`, `footer`, `sms-region-notice`.

Submit / back / flow-toggle also expose `button` (`part="submit button"`, `part="back button"`, `part="flow-toggle button"`). Style with `noizu-auth::part(card)` etc. External selectors cannot reach internal classes.

## `data-cy` hooks

Live names (Shadow DOM). Prefix in `registry.yaml` is `auth`; these hooks are unprefixed.

| `data-cy` | Node |
|-----------|------|
| `auth-card-wrap` | Interstitial shell |
| `auth-card` | Card |
| `auth-title` | Title |
| `email-input` | Email field |
| `password-input` | Password field |
| `otp-code-input` | OTP code field |
| `user_name-input` | Signup username |
| `first_name-input` | Signup first name |
| `last_name-input` | Signup last name |
| `mobile_phone-input` | Signup mobile |
| `invite_token-input` | Optional invite |
| `invite-token-hint` | Hint under the invite field (explicit `optional` only) |
| `sso-provider-list` | Provider list |
| `sso-provider-link` | Provider button (`data-provider` = id) |
| `submit-login` | Login / email-continue submit |
| `submit-signup` | Signup submit |
| `submit-magic-link` | Magic-link submit |
| `submit-otp-request` | OTP request submit |
| `submit-otp-verify` | OTP verify submit |
| `auth-error` | Error region |
| `mobile-phone-input` | `<noizu-phone-input>` for a mobile pipe |
| `sms-region-notice` | Inline SMS-region notice (hidden unless the region is blocked) |
| `custom-method` | Custom-method pane wrapper (`data-flow` = current flow) |

## Theming

Shadow DOM. Tokens and `::part()` are the public style API. Light-DOM rules cannot select internal classes. Avatar content sits outside the card bounds; modal content scrolls independently of the decorative avatar.
