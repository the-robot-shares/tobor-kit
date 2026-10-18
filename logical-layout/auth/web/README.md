# Standard authentication (`noizu-auth`)

Reusable sign-in and signup based on therobotplans.com's email-first registration and password, magic-link, email-code and configured SSO choices. Import `@noizu/tobor-kit/auth.js`; the main package also registers the element. React consumers can import `Auth` from `@noizu/tobor-kit/react.js`.

```html
<noizu-auth endpoint="/auth/socket" mode="interstitial">
  <strong slot="brand">My product</strong>
  <img slot="avatar" src="/images/robot.png" alt="Your robot guide">
</noizu-auth>
```

```js
const auth = document.querySelector('noizu-auth');
auth.options = {password: true, magicLink: false, otp: false, signup: true, providers: ['oidc', 'github']};
auth.text = {loginTitle: 'Welcome aboard', description: 'Continue to your workspace', close: 'Close account dialog'};
auth.avatar = {src: '/images/robot.png', alt: 'Your robot guide'};
// For a modal, set mode before opening. Native dialog supplies focus trapping.
auth.mode = 'modal';
auth.open = true;
```

`options`, `text`, `avatar`, and `pipes` are object properties, not serialized HTML attributes. Login and signup start with email discovery via `config({email})`. Exact, case-insensitive domain policies select host-provided SSO buttons; unmapped email domains continue to password. Email codes and links are hidden by default; opt in with `otp: true` or `magicLink: true`. Omitted password/signup flags default on; magicLink/otp require true when replacing the options object. An omitted providers list exposes all server-advertised providers; `[]` hides all. Options only hide UI; the backend must enforce enabled providers and methods. Server `config.methods` can further restrict local methods (`password`, `magic-link`, `otp`). `flow="signup"` selects registration: email discovery leads to configured domain SSO choices or password/profile signup. Matched SSO domains never expose a password fallback. Back changes the email and repeats discovery. Email, username, first/last name, mobile and an eight-character password match the source signup flow; invite token is optional. Account verification and SSO callback pages remain owned by the host.

`text` supports all labels in exported `AuthText`, including titles, description, field labels, method/action labels, close label, pending/loading/error fallback and sent-email notices. Provider labels come from server config. Browser constraint-validation messages follow the browser locale. Avatar configuration requires explicit alt text; use an empty string for a decorative avatar, or supply accessible slotted markup.

## Choosing a transport

The element speaks one internal transport contract with two implementations. Pick with the `transport` attribute:

| `transport` | Wire | Session model | Use when |
|---|---|---|---|
| unset (**default**) / `"socket"` | Same-host auth WebSocket at `endpoint` (`/auth/socket`) | Host cookie, set by a `/auth/session/finish` HTTP handoff. The element never sees a token. | Your host installs the `ToborKit.Auth.SocketPlug` adapter and owns an HttpOnly session cookie. |
| `"rest"` | JSON `POST {api-base}/auth/*` (default base `/api/v1`) | **Bearer tokens**, returned in the response body and handed to the host on `auth-success`. The element stores nothing. | Your app already exposes the portfolio REST auth contract (therobotplans.com and most portfolio apps). |

Nothing about the socket path changes when `transport` is unset — this is purely additive.

```html
<noizu-auth transport="rest" api-base="/api/v1" mode="dropdown">
  <button slot="trigger">Sign in</button>
</noizu-auth>
```

```js
const auth = document.querySelector('noizu-auth');
auth.pipes = ['email_password', 'mobile_otp', 'google'];
auth.addEventListener('noizu-auth-success', (event) => {
  const session = event.detail.session;      // undefined on the socket transport
  if (!session) return;                      // cookie session — nothing to store
  // The HOST decides where this lives. The component deliberately does not.
  myApp.adoptSession(session.accessToken, session.refreshToken);
});
```

**The component never writes tokens to `localStorage` or `sessionStorage`.** Token storage is a security decision with real trade-offs (XSS exposure, tab scope, refresh rotation, logout semantics) that belongs to the application, not to a reusable island. The element hands you the session once and forgets it.

**Cookies are omitted by default in REST mode** (`credentials: "omit"`). A Bearer API needs no ambient session, and sending one would make every unauthenticated auth `POST` indistinguishable from a first-party call — i.e. a login-CSRF target. Set `with-credentials` only if your REST backend really is cookie-session based, and then supply your own CSRF token handling.

`api-base` is validated the same way `endpoint` is: same-origin absolute path (or same-origin absolute URL), no query, no credentials, no foreign host.

REST endpoints called: `POST /auth/login`, `POST /auth/register`, `POST /auth/otp/{mobile,email}/start`, `POST /auth/otp/{mobile,email}/verify`, `POST /auth/mobile/register`, `POST /auth/mobile/login`, `GET /auth/merge/:challenge_id`, `POST /auth/merge/confirm`, and an optional `GET /auth/config` for provider/domain discovery (absent = no providers, never an error). `magic-link` has no REST equivalent and is refused with code `unsupported_method`.

Both transports normalize onto the same results and the same `AuthRequestError {message, code}`, so the UI renders identically: HTTP **409** `{"status":"merge_required", …}` becomes the same `merge_required` state as the socket's `{merge_required:true,…}` reply (backend pipe names `password_email` / `otp_mobile` are translated to the element's `email_password` / `mobile_otp`, identifiers stay masked), and HTTP **422** `{"error":"sms_region_unsupported"}` becomes the same inline region notice as the socket's `error.code` of the same name.

## Backend and transport (WebSocket)

**An anonymous auth WebSocket endpoint must be installed on the serving host.** The serving page must bootstrap the host prelogin HTTP session and browser binding before connecting; follow the adapter setup example. Existing Phoenix product `/socket` endpoints require an existing login and are not suitable. See [the mountable Elixir adapter](../../../../../docs/auth-socket.md), which connects host-owned account logic to this transport.

Default endpoint `/auth/socket` is a same-host absolute path. HTTPS pages use WSS. A development port is permitted only with both `development` and `dev-port="4000"`; scheme and hostname stay unchanged. Production should use a same-origin reverse proxy. In development, proxy HTTP provider and session-handoff `/auth` routes through the frontend server too: redirects resolve against the page origin, not the WebSocket port. The server separately validates WebSocket Origin and must explicitly allow development frontend ports.

Protocol: `{version:1,id:"1",method:"login",params:{email,password}}`; response `{id:"1",result:{...}}` or `{id:"1",error:{code,message}}`. Methods: `config`, `login`, `register`, `magic-link`, `otp-request`, `otp-verify`. Config returns `providers:[{id,label?,href}]`, optional `methods`, and `domain_policies`/`domains` keyed by email domain, each a provider ID array or `{providers:[...]}`. Registration params are `{user:{email,password,user_name,first_name,last_name,mobile_phone},invite_token}`. OTP verify uses `{email,code}`.

Authentication completion should return `{redirect:'/auth/session/finish?code=one-time-code'}`. The host HTTP handler consumes that short-lived single-use code bound to that browser’s prelogin HTTP session, verifies the same binding, rotates the session, and sets its HttpOnly session cookie. The upgrade plug must receive the host-generated browser binding in `conn.private`; see the adapter setup for its exact key. A WebSocket cannot set a browser cookie after upgrade. The component follows only same-origin HTTP(S) redirects; it never performs browser-side client-secret exchange. `{status:'pending'}` shows the verification notice. `{authenticated:true}` is accepted only for hosts that already completed a session; do not use it merely to acknowledge password validation.

Events bubble and cross the shadow boundary: `auth-redirect` `{url}`, `auth-success` `{session?}` (on the socket transport the detail is `{}` — only for already-completed sessions; on the REST transport it carries the Bearer `session`), `auth-error` `{message}`, `auth-close` `{}`. On the socket transport, passwords and returned token/user objects are never emitted. Requests time out after 15 seconds, correlate by ID, and reject on disconnect; closing the modal cancels in-flight work. The server owns rate limiting, verification, session establishment, allowed providers, and CSRF/Origin checks.

## Themes and layout

Shadow DOM contains semantic classes, with public parts: `shell`, `dialog`, `dropdown-wrap`, `trigger`, `dropdown-panel`, `card`, `content`, `avatar`, `brand`, `title`, `description`, `providers`, `provider`, `pipes`, `pipe`, `merge-required`, `merge-description`, `merge-pipes`, `merge-pipe`, `merge-confirm`, `methods`, `method`, `form`, `field-group`, `field-label`, `field-input`, `button`, `submit`, `close`, `back`, `flow-toggle`, `status`, `error`, `sms-region-notice`, `footer`. Use `noizu-auth::part(card)` etc. External styles cannot select internal classes directly.

Tokens: `--auth-color`, `--auth-font`, `--auth-background`, `--auth-page-background`, `--auth-page-height`, `--auth-width`, `--auth-padding`, `--auth-border`, `--auth-radius`, `--auth-shadow`, `--auth-muted`, `--auth-input-background`, `--auth-button-background`, `--auth-accent`, `--auth-on-accent`, `--auth-focus`, `--auth-error`, `--auth-backdrop`, `--auth-avatar-size`, `--auth-avatar-right`, `--auth-avatar-top`, `--auth-dropdown-gap`, `--auth-dropdown-z`, `--auth-dropdown-shadow`, `--auth-sms-region-color`. Avatar content sits outside the card bounds; modal content scrolls independently. Slots: `avatar`, `brand`, `footer`, `trigger` (`mode="dropdown"` only). Keep controls out of the decorative avatar slot.

Run `npm run typecheck`, `npm run test:browser`, `npm run build`, and `npm run test:react` in `web/`.

## Seven pipes, dropdown mode, and account merging

The legacy email flow above (`options`-driven password/magic-link/otp) is unchanged and stays the default when `pipes` is unset. Setting `pipes` switches to a data-driven pipe selector covering all seven supported pipes:

```js
auth.pipes = ['email_password', 'mobile_password', 'email_otp', 'mobile_otp', 'google', 'authentik', 'github'];
```

The host declares which of the seven are enabled (and may supply `{id, label}` for a custom label); the component always renders enabled pipes in that canonical order and never hardcodes a fixed list. `mobile_password` / `mobile_otp` reuse `<noizu-phone-input>` for the E.164 identifier. `google` / `authentik` / `github` render a single redirect button resolved against `config.providers`, matching the existing SSO mechanism.

`mode="dropdown"` adds a third mode alongside `interstitial` and `modal`: an anchored, non-modal popover opened from a trigger. By default the component renders its own trigger button; slot a `<button slot="trigger">` to use your own — the component wires its click and keeps `aria-expanded`/`aria-controls` in sync on it. The dropdown panel is not a dialog: it does not trap focus, but it does move focus into the panel on open and return it to the trigger on close, and it closes on outside click or Escape. Per the intended UX split, **signup uses `modal`, login uses `dropdown`** — both are modes of the same component, and toggling the flow while `mode="dropdown"` automatically switches to `modal` for signup and back for login.

```html
<noizu-auth mode="dropdown" .pipes=${['email_password', 'google']}>
  <button slot="trigger">Sign in</button>
</noizu-auth>
```

Registration and login can return `{merge_required: true, challenge_id, pipes: [{type, masked}]}` when the identifier already belongs to an account. `masked` is **always** a masked identifier (e.g. `g****@gmail.com`) — the component never renders, stores, or assumes an unmasked one. The user then authenticates through one of the listed existing pipes; that request carries `merge_challenge_id`. Until the backend replies with `merge_confirmed: true` (or `authenticated: true` on that confirming call), the new pipe is **not** active and **no session exists**.

Additive events (existing event names are unchanged): `noizu-auth-submit` `{pipe, flow}`, `noizu-auth-success` `{session?}` (alongside `auth-success`, identical payload; `session` only on the REST transport), `noizu-auth-error` `{message}` (alongside `auth-error`), `noizu-auth-merge-required` `{challengeId, pipes}`, `noizu-auth-merge-confirmed` `{challengeId?}`, `noizu-auth-otp-requested` `{pipe}`, `noizu-auth-sms-region-unsupported` `{pipe, message}`, `noizu-auth-invite-required` `{url, source}` (explicit `invite-token-mode="optional"` only; cancelable). `pipes` mode still emits `auth-close` / `auth-redirect` for modal/dropdown dismissal and SSO handoff.

## Console layout (the default)

The element has two arrangements. **`layout="console"` is the default**: the portfolio-standard sign-in console, and the surface every product should be rendering. `layout="tabs"` is the opt-out — the original flat row of pipe buttons with the selected pipe's form below it — kept for a host that built around it. Nothing about the tab arrangement itself changed.

The console arranges the surface top to bottom:

1. title and a "choose how you'd like to continue" subtitle
2. the social pipes as icon buttons in a responsive grid (official Google mark, a key for `authentik`, the Octocat for `github`)
3. an `or` rule — rendered only when there are social pipes *and* something below them to separate
4. a segmented **email / mobile** toggle — rendered only when **both** `email_password` and `mobile_password` are enabled, so a host without SMS gets no dead control
5. the credential form, with uppercase labels over the inputs and a full-width submit. A host with no password pipe at all gets its first one-time-code pipe inline here, rather than a console whose only control is a link
6. the one-time-code pipes as text links ("email me a code · text me a code") rather than tabs; opening one replaces the console with that pipe's form plus a **back** control
7. a hairline and the opposite flow ("new here? get started", inverted on signup)

```html
<noizu-auth mode="modal" open transport="rest" api-base="/api/v1"></noizu-auth>
```
```js
auth.pipes = ['email_password', 'email_otp', 'google', 'authentik', 'github'];
```

Only structure and spacing change. Every colour still comes from the same `--auth-*` tokens the tab layout uses, so a host that has already themed the element does not theme it twice; the console adds `--auth-control-radius`, `--auth-field-radius`, `--auth-label-font` and `--auth-link` on top. New `text` keys: `chooseMethod`, `or`, `identifierType`, `segmentEmail`, `segmentMobile`, `emailCodeLink`, `mobileCodeLink`, `getStarted`, `logInLink`, `providersUnavailable`, `consoleBack`.

New parts for host styling: `sso-button`, `provider-icon`, `divider`, `segments`, `segment`, `otp-links`, `otp-link`, `console-foot`, `providers-unavailable`.

Default copy is the reference register — `log in`, `sign up`, `choose how you'd like to continue`, `or`, `email me a code · text me a code`, `new here? get started`, `already have an account? log in` — and the `authentik` pipe reads `Continue with SSO`, since SSO is what the person is choosing and Authentik is only how it is implemented. Every string stays overridable through `text`.

**The legacy `options` flow renders in the console arrangement too.** Its state machine is untouched, and domain routing still wins: at the `sso` step only the matched providers render and there is no credential form. What changed is that the configured providers now appear in the social grid from the first step, instead of appearing only after a domain policy matched. `layout="tabs"` restores the previous surface.

Opening focus lands on the first social button, else the first field, and waits for provider discovery rather than letting the first field win a race the user never sees. The close control renders last in DOM order and is quiet until hover or focus, so opening a modal does not park a focus ring on "dismiss".

The `authentik` pipe resolves against a provider published as either `authentik` or `oidc` — a backend that names the same Authentik deployment by its protocol still lights the button up rather than rendering it disabled. It keeps the `data-cy="sso-provider-link"` / `data-cy-id="oidc"` pair the shared Authentik e2e helper looks for.

A social pipe whose provider the server did not publish renders disabled, and the console names it once underneath the grid (`providersUnavailable`) instead of leaving a dead button to explain itself.

## Custom method (host-provided sign-in)

For a product whose sign-in is neither email nor OAuth — therobot.institute's Ed25519 device-key sign-in is the first — `custom-method` keeps the kit's card and shells and hands the middle of the card to the host.

```html
<noizu-auth mode="modal" custom-method>
  <strong slot="brand">therobot.institute</strong>
  <div slot="method-login">…sign a challenge with your key…</div>
  <div slot="method-register">…generate a key…</div>
</noizu-auth>
```

```js
auth.text = {loginTitle: 'sign in with your key', signupTitle: 'join the institute'};
auth.open = true;
// …the host runs its own exchange, then:
auth.complete({entityId});   // fires auth-success with exactly this detail, closes a modal/dropdown
auth.fail(error);            // fires auth-error {message, code?}, shows the message, stays open
```

- **Switch:** the boolean `custom-method` attribute (`customMethod`), or `pipes = ['custom']`.
- **What stays:** the `brand`, `avatar` and `footer` slots, the title (per-flow `text.loginTitle` / `text.signupTitle`), the close ×, the `interstitial` / `modal` / `dropdown` shells, native-dialog focus trapping, Escape, `auth-close`, and the `open` / `flow` attributes. Opening focus lands on the first focusable control in the host's pane. The subtitle renders only when the host sets `text.description`. The footer still offers the opposite flow unless `options.signup` is `false`.
- **What goes:** every built-in pipe, the email field, the tabs, the social grid and the merge screens. The card renders a `method` part holding one slot pane per flow: `method-login` for `flow="login"`, and `method-signup` (or its alias `method-register`) for `flow="signup"`. Each falls back to a shared `method` slot, so a host with one pane uses only `method`. Panes not assigned to the current flow are not rendered.
- **No network, no verification widget.** The element makes no request in this mode: no `/auth/config`, no WebSocket, no REST call, on either transport. It never mounts `<noizu-human-verify>` (the auth element never imports it in any mode). Anti-abuse and every credential check belong to the host's own exchange, server-side.
- **Flow switching from slotted content:** dispatch `auth-flow-switch` with `{flow: 'login' | 'signup' | 'register'}` (bubbling) from inside a pane, or set `flow`. The element fires `noizu-auth-flow-change` `{flow}` whenever the flow changes in this mode.

`complete()` and `fail()` also work outside custom mode, but a built-in pipe already reports its own outcome, so there is rarely a reason to call them there. A worked page is in [demo/auth-custom-method.html](../../../demo/auth-custom-method.html); a copyable snippet is in [examples/html/custom-method.html](examples/html/custom-method.html).

## SMS region gating (`smsRegions`)

Some hosts can only deliver SMS in certain regions (e.g. carrier registration such as US A2P 10DLC is incomplete). Set `smsRegions` to surface that clearly instead of letting a `mobile_password` / `mobile_otp` submit go into a black hole:

```js
auth.smsRegions = {supported: ['US', 'CA', 'GB'], message: 'Texting is not available in your region yet — try email instead.'};
```

`supported` is ISO-3166 alpha-2, derived the same way `<noizu-phone-input>` already reports it (`country` / `country-change`) — no second country table. Leaving `smsRegions` unset is fully backwards compatible: no gating at all, identical to today. When set and the resolved region is unsupported: an inline notice appears next to the phone input (`part="sms-region-notice"`, associated via `aria-describedby`), the pipe's submit control becomes `aria-disabled` (kept focusable and screen-reader announced — not natively `disabled`, so keyboard users can still reach and understand it) rather than hidden, and every other pipe keeps working normally. **The server is authoritative**: a `sms_region_unsupported` error on submit (see `docs/backend-requirements.md`) always renders the server's own message here, even without `smsRegions` set.

## Invite-gated signup with fallback (`invite-token-mode` + `invite-fallback-url`)

`invite-token-mode` controls the signup invite field: `optional` (default, today's behaviour), `required` (marks the field required and blocks empty submits client-side — the server stays authoritative), or `hidden` (removes the field and omits the `invite_token` register param; unknown values clamp to `optional`).

For hosts that hard-gate signup on invites, pair `invite-token-mode="required"` with `invite-fallback-url` so a rejected token does not strand the user on a dead error. When the server rejects `register` with its invite-rejection machine error (`invalid_invite_token` in the `AuthRequestError` `code` or `message`, case-insensitive — both transports normalize to this; status codes are not consulted), the element surfaces the error state and events as usual, shows the `text.inviteFallbackNotice` status line, then navigates the browser to the fallback URL:

```html
<noizu-auth
  flow="signup"
  invite-token-mode="required"
  invite-fallback-url="/waitlist"></noizu-auth>
```

```js
auth.text = {inviteFallbackNotice: 'This invite has expired — taking you to the waitlist…'};
```

With the attribute unset (or the resolved invite mode not `required`), behaviour is unchanged: the error is shown and nothing navigates. The element emits `auth-error` (and `noizu-auth-error` in `pipes` mode) before navigating, so hosts can still observe the rejection.

## Invite interstitial (`invite-token-mode="optional"` + `invite-required-url`)

For the "register open, app gated" pattern (signup never fails for a missing invite; a held account
redeems one at an interstitial), set `invite-token-mode="optional"` **explicitly** and serve
`<noizu-invite-gate>` at `/auth/invite-required`:

```html
<noizu-auth flow="signup" transport="rest" invite-token-mode="optional"></noizu-auth>
```

- The field stays optional and gets a hint: "have an invite? enter it now — otherwise you can add it after signing up." (`text.inviteHint`, `data-cy="invite-token-hint"`, wired via `aria-describedby`).
- A `register` that comes back held — the `invite_required` error code (prose alone never matches), or a success whose `user` / `session.user` has `invite_required: true` — never renders the error block. The element emits `auth-success` first when the account was created (a REST host stores its Bearer token there), shows `text.inviteRedirectNotice`, emits the cancelable `noizu-auth-invite-required` `{url, source}`, and navigates to `invite-required-url` (default `/auth/invite-required`).
- On the error path (`source: "register-error"`) the element deliberately emits neither `auth-error` nor `auth-success`: the account is held, not failed, and no session was issued. `noizu-auth-invite-required` is the signal; cancel it to handle the hold yourself.
- `invite-required-url=""` turns the routing off. Leaving `invite-token-mode` unset keeps the pre-0.2 behaviour exactly; `required` and `hidden` are unchanged.

## Domain routing

The backend `config` handler receives `{email}` after Continue. Return `providers`
and `domain_policies` for the entered email; the initial request has no email.
For example, configure these exact domain mappings in the host adapter:

```json
{
  "providers": [
    {"id":"authentik","label":"Continue with Authentik","href":"/auth/authentik"},
    {"id":"google","label":"Continue with Google","href":"/auth/google"},
    {"id":"github","label":"Continue with GitHub","href":"/auth/github"}
  ],
  "domain_policies": {
    "noizu.com": {"providers":["authentik"]},
    "therobotlives.com": {"providers":["google"]},
    "therobot.is": {"providers":["github"]}
  }
}
```

The host owns confidential OAuth/OIDC or SAML start/callback routes and enforces
the policy on authentication requests. Domain matching uses equality, not suffix
matching (`evilnoizu.com` does not match `noizu.com`). Client options filter the
available choices; hiding a mapped provider does not expose password as a bypass.
Provider routing is presentation, never authorization.
