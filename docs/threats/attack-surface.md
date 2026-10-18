# Attack Surface (detail)

Enumeration of ingresses, stores, and egresses for
[`../THREAT-MODEL.md`](../THREAT-MODEL.md).

## Ingress

| Entry point | Location | Notes |
|-------------|----------|-------|
| Guide API (OpenAPI) | `elixir/`, `go/` | /guide, /sessions*, /mcp/tools, /voice/token, /telemetry/consent — host-fronted |
| Auth socket `/auth/socket` | `web/src/components/auth` + host | Same-origin default; `transport="rest"` opt-out; origin fail-closed |
| OIDC callback | `elixir/.../auth/oidc.ex`, `swift/.../Auth/OIDCAuthClient.swift` | state+nonce+PKCE verifier in session, cleared on use |
| Voice/session WS | `backend/` (Node) | Bidirectional protocol for `<tobor-voice-agent>` |
| Cypress demos | `web/demo`, `web/e2e` | Dev/test only — never deployed |

## Stores

| Store | Location | Sensitivity |
|-------|----------|-------------|
| ETS session table | `elixir/lib/tobor_kit/session.ex` | Volatile session state; public named table, in-process only |
| TokenStore | `swift/Sources/ToborKitCore/Auth/TokenStore.swift` | Client-side tokens |
| Secrets | `helm/tobor-kit/templates/infisical-secret.yaml` | Synced by Infisical operator into pods |

## Egress

| Destination | Trigger |
|-------------|---------|
| LLM providers | Turn execution (`elixir/.../provider*`) |
| OIDC IdP (Authentik) | Discovery + token exchange |
| npm.noizu.com + lit CDN | CI publish (`publish-lit.yml`, `scripts/publish-*`) |
