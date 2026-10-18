# login-flow family — Hologram mirror (p2, group B)

Mirror of `web/src/components/login-flow/` (`tobor-login-flow`). Contract:
`docs/PORTING.md` §1 (class B + commands, §6.7), §6.8 (external redirect),
§9 (server round-trip); tokens: `docs/THEMING.md`.

## Module

| Lit tag | Mirror | Class |
|---|---|---|
| `tobor-login-flow` | `ToborKit.Hologram.LoginFlow.Flow` | B + commands |

## Usage

```holo
<LoginFlow
  cid="my-login"                       # required for stateful init
  auth={%{
    "provider" => "oidc",
    "issuer" => "https://auth.example.test",
    "client_id" => "my-public-client",
    "scopes" => ["openid", "email", "profile"],
    "redirect_path" => "/auth/oidc/callback"
  }}
  callback_search={@callback_search}   # host-routed callback query string
  auto_redirect={true}                 # false → render <a> fallback + emit redirect
  target="page"
/>
```

`auth` is the GuideAuth projection block — all public. `issuer`/`client_id`/
`scopes`/`redirect_path` may safely ride props (client-visible); the
**client_secret never may** (see Security model).

## Command contract

| Command | Params (public only) | Result actions |
|---|---|---|
| `:begin_login` | `%{issuer, client_id, redirect_path, scopes}` | `:auth_redirect %{url}` \| `:exchange_failed %{error}` |
| `:exchange` | `%{code, state, issuer, client_id, redirect_path}` | `:exchange_ok %{tokens}` \| `:exchange_failed %{error}` |

Required HostConfig scope: **`:auth`** — `%{client_secret: ...}` (optional)
plus `redirect_uri:` or `origin:` to canonicalize the redirect. Example:

```elixir
config :tobor_kit_hologram, :host_config,
  auth: [
    client_secret: System.fetch_env!("OIDC_CLIENT_SECRET"),
    redirect_uri: "https://my-app.example.test/auth/oidc/callback"
  ]
```

## Events (registry-verbatim → action atoms, forwarded to `:target`)

* `tobor-auth-token` → `:tobor_auth_token` `%{access_token, token_type, expires_in, id_token}`
* `tobor-auth-error` → `:tobor_auth_error` `%{error: message}`
* `tobor-auth-redirect` → `:tobor_auth_redirect` `%{url}` — **only when `auto_redirect` is false** (divergence: one `next_action` per handler; when the mirror is about to `location.assign` via §6.8 JS interop, the forward is dropped — the browser is leaving)

## Token-handoff decision

The exchange result forwards `access_token` (the host needs it to call
APIs), `token_type`, `expires_in`, and `id_token`. **`refresh_token` is
dropped** — it is a long-lived privileged grant and belongs to the host's
own backend. Component state keeps only the `:signed_in` flag; tokens
exist solely in the action params at the handoff instant.

## Security model + divergences

* PKCE verifier/state are generated **server-side** (`:crypto`) and
  stashed in the Hologram session (`put_session/3`), not `sessionStorage`
  — strictly stronger than the Lit contract (the verifier is never
  client-visible).
* PKCE challenge (SHA-256) is computed server-side — `crypto.subtle` has
  no transpiled equivalent (PORTING.md §6.1).
* The `:exchange` command consumes the verifier (one-shot), matches
  `state` against the session, and maps HTTP failures to
  `tobor-auth-error` (never raises across the wire, §9 rule 2).
* Query params are matched verbatim — no percent-decoding (OIDC values
  are URL-safe by spec).
* `history.replaceState` address-bar cleanup is the host's job (the
  callback search is host-provided).

## Theming + test hooks

CSS at `.tk-login-flow*` in `assets/css/tobor-kit.css` (marked `(p2)`).
data-testid contract (registry gap policy — Lit source, verbatim):
`login-button`, `login-user`, `login-error`.

## Backend section

* Token endpoint: `POST {issuer}/token`, form-encoded
  (`Support.Http.post_form/3`), `grant_type=authorization_code`,
  `code_verifier` from session, `client_secret` appended when the
  `:auth` scope provides one.
* Issuer is normalized (trailing slashes stripped — the Authentik
  per-provider quirk carried over from Lit).
