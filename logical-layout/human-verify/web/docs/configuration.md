# Configuration — noizu-human-verify

Tags in this family: **`noizu-human-verify`**.

Shadow-DOM island. Properties down, one event up. Hosts own siteverify, secrets, redirects, cookies, and persistence. The element carries **no secrets** and never treats a browser token as proof.

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Tags

| Tag | File |
|---|---|
| `noizu-human-verify` | `noizu-human-verify.ts` |

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `provider` | `string` | no | `none` | yes | `turnstile` \| `recaptcha-v3` \| `none`. Case-insensitive. Any other value clamps to `none` (attribute is not rewritten). |
| `site-key` (`siteKey`) | `string` | for `turnstile` and `recaptcha-v3` | `""` | yes | **PUBLIC** site key only. Never a secret / API secret. Empty + a widget provider shows status “Public site-key required.” and does not inject scripts. |
| `action` | `string` | no | `signup` | yes | Passed to Turnstile `render` and reCAPTCHA v3 `execute`. Whitespace-only falls back to `signup`. |

`provider=none`: emit `verified` `{provider:'none', token:''}` on connect (and on `reset()`). Host that opts out of a challenge.

`provider=turnstile`: inject Cloudflare Turnstile `api.js?render=explicit` if needed, render into `verify.widget`, emit on success callback.

`provider=recaptcha-v3`: inject `grecaptcha` with `?render=<site-key>`, `execute(action)`, emit the token.

## Events

Bubbling, composed `CustomEvent`s via kit `emit()`.

| Event | Detail | When |
|---|---|---|
| `verified` | `{provider: 'turnstile' \| 'recaptcha-v3' \| 'none', token: string}` | Turnstile success callback; reCAPTCHA v3 `execute` resolved; or `provider=none` on connect / `reset()`. |

**Not proof.** Listeners MUST POST `token` to the provider siteverify endpoint (see [backend-requirements.md](backend-requirements.md)). The kit never siteverifies.

No error event. Load / missing-key failures surface in `::part(status)` only.

## Methods

| Name | Args | Notes |
|---|---|---|
| `reset()` | none | `none` re-emits `verified`. `turnstile` calls `turnstile.reset(widgetId)` when a widget exists, otherwise remounts. `recaptcha-v3` executes again. |

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Style tokens on the host (or an ancestor); do not pierce.

| Token | Default |
|---|---|
| `--tobor-kit-font-family` | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--tobor-kit-bg` | `#12131a` |
| `--tobor-kit-surface` | `#1b1d27` |
| `--tobor-kit-fg` | `#e8e9f0` |
| `--tobor-kit-muted` | `#9aa0b4` |
| `--tobor-kit-accent` | `#6ee7c7` |
| `--tobor-kit-accent-fg` | `#08130f` |
| `--tobor-kit-border` | `#2c2f3d` |
| `--tobor-kit-danger` | `#ff6b6b` |
| `--tobor-kit-warn` | `#f5c451` |
| `--tobor-kit-radius` | `12px` |
| `--tobor-kit-gap` | `12px` |
| `--tobor-kit-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` |
| `--tobor-kit-duration` | `320ms` |

| `::part()` | Node |
|---|---|
| `root` | Outer wrapper (`data-cy="verify.root"`) |
| `widget` | Provider mount node (`data-cy="verify.widget"`) |
| `status` | `role="status"` live region (missing key / load failure) |

No styleguide classes. The Turnstile iframe is a child of `::part(widget)`. reCAPTCHA v3 is invisible; Google may append its badge to `document.body` (outside this shadow tree).

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix `verify`. Hooks live **inside Shadow DOM**. No `data-testid`.

| Hook | Node |
|---|---|
| `verify.root` | Outer wrapper |
| `verify.widget` | Provider mount node |

## Theming

Closed shadow tree. Restyle via `--tobor-kit-*` on `:host` / ancestors and `::part()`. Do not pierce with `::slotted` (no slots). Light-DOM page CSS cannot target the inner markup.
