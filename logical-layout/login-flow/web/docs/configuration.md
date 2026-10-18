# tobor-login-flow — configuration

Full options surface for `<tobor-login-flow>`. Condensed usage stays in [README.md](../README.md). Host/API contract: [backend-requirements.md](./backend-requirements.md).

## Tags

| Tag | Module |
|---|---|
| `tobor-login-flow` | `@noizu/tobor-kit/login-flow.js` |

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `auth` | `GuideAuth` (object) | yes | — | no | **Property-only** (`attribute: false`). `{required?, provider?, issuer?, client_id?, scopes?, redirect_path?}`. Never a client secret. |
| `callbackSearch` (`callback-search`) | `string \| null` | no | `null` → `location.search` | no | Query string treated as the OAuth callback. Set `""` so the element does not consume `location.search` (host-owned callback pages). |
| `autoRedirect` (`auto-redirect`) | boolean | no | `true` | no | After `tobor-auth-redirect`, `location.assign` the authorize URL. Set `false` when the host owns navigation. |

`GuideAuth.provider`: `oidc` \| `authentik` \| `none`. `authentik` applies the trailing-slash issuer quirk. `provider: "none"` or `required: false` renders nothing.

## Events

Bubbling, composed. `detail` is the payload.

| Event | Detail | When |
|---|---|---|
| `tobor-auth-redirect` | `{url: string}` | Authorize URL is ready (PKCE verifier already stashed in `sessionStorage`). |
| `tobor-auth-token` | `{tokens: OAuthTokens}` | Code exchange succeeded. `OAuthTokens`: `access_token`, optional `token_type`, `id_token`, `refresh_token`, `expires_in`. |
| `tobor-auth-error` | `{error: string}` | Callback parse, state mismatch, missing verifier, or token exchange failed. |

The host owns redirects and session cookies. Treat `tobor-auth-token` as a browser signal — persist the session on the host (see backend-requirements). Do not keep tokens in JS.

## Methods

None on the element.

## Exported helpers

Framework-free exports from the same module (`@noizu/tobor-kit/login-flow.js`). Hosts can run the flow without the element.

| Helper | Signature | Notes |
|---|---|---|
| `beginLogin` | `(auth: GuideAuth, options?: {redirectUri?: string, storage?: Storage}) => Promise<LoginRedirect \| null>` | Builds the authorize URL; stashes PKCE `state` + `verifier` in `sessionStorage`. Returns `null` when `issuer`/`client_id` is missing or `provider === "none"`. |
| `completeLogin` | `(auth: GuideAuth, search: string, options?: {redirectUri?: string, storage?: Storage, fetchImpl?: typeof fetch}) => Promise<OAuthTokens>` | Parses `code`+`state`, checks stored state, POSTs the verifier to the IdP token endpoint. |
| `buildAuthorizeUrl` | `(options) => string` | `{issuer, clientId, redirectUri, scopes, state, codeChallenge}` → `{issuer}/authorize?…` (`response_type=code`, `code_challenge_method=S256`). |
| `exchangeCode` | `(options) => Promise<OAuthTokens>` | POST `{issuer}/token` as `application/x-www-form-urlencoded` (`grant_type=authorization_code`, `client_id`, `redirect_uri`, `code`, `code_verifier`). Public client — no secret. |
| `parseCallback` | `(search: string) => {code, state} \| null` | Reads `code` and `state` from a query string. |
| `normalizeIssuer` | `(issuer: string) => string` | Strips trailing slashes (Authentik per-provider issuers 404 discovery otherwise). |
| `randomVerifier` / `codeChallenge` | PKCE primitives | S256 challenge is `base64url(sha256(verifier))`. |

`beginLogin` default `redirectUri` is `new URL(auth.redirect_path ?? "/auth/oidc/callback", location.href)`.

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Tokens from `mode-toggle/theme` (`toborKitTokens`, `toborKitControls`).

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-fg` | `#e8e9f0` | Text |
| `--tobor-kit-muted` | `#9aa0b4` | Signed-in label |
| `--tobor-kit-accent` | `#6ee7c7` | Button hover / focus |
| `--tobor-kit-accent-fg` | `#08130f` | Text on accent |
| `--tobor-kit-border` | `#2c2f3d` | Button border |
| `--tobor-kit-danger` | `#ff6b6b` | Error notice |
| `--tobor-kit-warn` | `#f5c451` | Notice border |
| `--tobor-kit-radius` | `12px` | Control radius |

| `::part()` | On |
|---|---|
| `button` | Sign-in control |

No other parts.

## `data-cy` / `data-testid`

`registry.yaml` `cy_prefix`: `login`. No `data-cy` list is frozen yet. Shadow hooks (grandfathered `data-testid`):

| Hook | When |
|---|---|
| `[data-testid="login-button"]` | Sign-in button (OIDC required) |
| `[data-testid="login-user"]` | Signed-in label after a successful exchange |
| `[data-testid="login-error"]` | Error notice |

New hooks, if added, must be `data-cy="login.<name>"`.

## Theming

Shadow DOM — restyle through the `--tobor-kit-*` tokens and `::part(button)`. Do not pierce the shadow tree. Light DOM is not used.
