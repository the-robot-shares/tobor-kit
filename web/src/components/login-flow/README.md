# tobor-login-flow

OIDC login flow element: builds the authorize URL, handles the redirect callback, and exchanges the code for tokens.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/login-flow/login-flow.js"></script>

<tobor-login-flow></tobor-login-flow>
```

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `auth` | Object | yes | — | GuideAuth: `issuer`, `client_id`, `scopes`, `redirect_path`, `provider` (property-only) |
| `callbackSearch` (`callback-search`) | String | no | `location.search` | Query string treated as the OAuth callback |
| `autoRedirect` (`auto-redirect`) | Boolean | no | `true` | Redirect automatically on login start |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-auth-redirect` | `{url}` | Redirecting to the IdP |
| `tobor-auth-token` | `{tokens: OAuthTokens}` | Code exchange succeeds |
| `tobor-auth-error` | `{error}` | Login fails |

## Module exports

Helpers are also exported from the module: `beginLogin`, `completeLogin`, `buildAuthorizeUrl`, `exchangeCode`, `parseCallback`.

## Theming

Consumes the shared `--tobor-kit-*` tokens (see `web/README.md`). Shadow `::part(button)`.

## Docs

- [configuration.md](./docs/configuration.md) — full options, events, helpers, hooks
- [backend-requirements.md](./docs/backend-requirements.md) — host-owned token + cookies
- [examples](./examples/README.md) — CDN / npm / Elixir / Go / Python / Rust
