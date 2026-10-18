# noizu-human-verify

Shadow-DOM human-verification island (Cloudflare Turnstile, reCAPTCHA v3, or opt-out).

The `verified` event is **not proof**. The host MUST POST the token to the provider's siteverify API. The kit never verifies. `site-key` is the **public** site key only — never a secret.

Full options: [docs/configuration.md](docs/configuration.md). Host API: [docs/backend-requirements.md](docs/backend-requirements.md). Mount snippets: [examples/README.md](examples/README.md).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/human-verify/noizu-human-verify.js"></script>

<noizu-human-verify provider="none" action="signup"></noizu-human-verify>
```

`provider="none"` (default) emits `verified` `{provider:"none", token:""}` on connect — the host opted out.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `provider` | String | no | `none` | `turnstile` \| `recaptcha-v3` \| `none` |
| `site-key` | String | for widgets | `""` | PUBLIC site key (reflected). Never a secret |
| `action` | String | no | `signup` | Turnstile / reCAPTCHA v3 action |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `verified` | `{provider, token}` | Challenge succeeded, or `provider=none` on connect / `reset()` |

## Methods

| Name | Notes |
|---|---|
| `reset()` | none re-emits; turnstile resets the widget; recaptcha-v3 executes again |

## data-cy

`verify.root` `verify.widget`

## Theming

Shadow DOM. Style `--tobor-kit-*` tokens on the host; `::part(root|widget|status)`.
