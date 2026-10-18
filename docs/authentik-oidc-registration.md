# Authentik OIDC Registration — tobor-kit (DRAFT)

Status: **DRAFT — nothing registered yet.** This documents the Authentik
application the tobor-kit login-flow demo needs. Registration is a manual /
ops step; whoever registers MUST NOT embed the client id in git — it lands in
Infisical (`/apps/tobor-kit`) and flows to the pod via the InfisicalSecret in
`helm/tobor-kit/`.

## Flow shape

Public PKCE — Authorization Code + S256, **no client secret**. The backend
mints/verifies nothing secret-side beyond the public config keys:

- `TOBOR_KIT_OIDC_ISSUER`
- `TOBOR_KIT_OIDC_CLIENT_ID` (via InfisicalSecret → `tobor-kit-secrets`)
- `TOBOR_KIT_OIDC_REDIRECT_URI`

These map to `config :tobor_kit, ToborKit.Auth.OIDC` (`elixir/config/config.exs`,
runtime overrides in `elixir/config/runtime.exs`).

## Authentik application / provider parameters

| Field | Value |
| --- | --- |
| Provider type | OAuth2/OpenID Connect (Authorization code, PKCE required) |
| Client type | Public (no client secret) |
| Issuer / slug | Authentik-hosted issuer URL for the new application slug — TBD at registration time; the fleet OIDC host is the shared Authentik instance (see monorepo `docs/authentik-oidc-setup.md` for conventions and the admin token lookup via `dc`) |
| Scopes | `openid profile email` (tobor-kit default, `config.exs`) |
| Redirect URI (demo) | `https://infra.noizu.com/lit-dev` |
| Redirect URI (callback) | `https://infra.noizu.com/lit-dev/auth/callback` — **TBD: exact callback path is set by the ComponentDemo wiring (infra.noizu.com lit section); confirm before registering** |
| Post-logout URIs | TBD — same place the logout redirect gets wired |
| Property mappings | Default `openid` / `profile` / `email` |

## Registration steps (once the TBDs are resolved)

1. Create the provider + application on the shared Authentik instance using an
   admin session or the admin API token (kept in `dc` under
   `auto.authentik_api_token`; never print or commit values).
2. Store the generated client id in Infisical at `/apps/tobor-kit` (declarative
   path: monorepo `.infisical-secrets.yaml`, then `infisical-populate-secrets`).
3. The InfisicalSecret in `helm/tobor-kit` picks it up on the next sync;
   `secrets.infisical.enabled=true` in values.

## Who flips it live

Ops (team-lead / infra owner) performs registration + the Infisical write after
the demo wiring lands. No deploy changes needed beyond the values above — the
chart already wires the env keys.
