# AuthN / AuthZ Controls (detail)

Control details for [`../THREAT-MODEL.md`](../THREAT-MODEL.md). Full socket
contract: [`../auth-socket.md`](../auth-socket.md).

## OIDC (T-001, T-004)

`elixir/lib/tobor_kit/components/auth/oidc.ex`:

- `state` and `nonce` live in the session; `state` cleared after use.
- Callback verifies ID token signature, `iss`, `aud`, `exp`, and the nonce.
  An IdP that omits the nonce is tolerated; one returning a **different**
  nonce is rejected.
- Issuer is trimmed of trailing slash before discovery (Authentik
  per-provider issuers 404 otherwise).
- PKCE verifier carried through the session and rotated after redeem.

Swift side mirrors this: `OIDCAuthClient.swift`, `PKCE.swift`,
`TokenStore.swift`.

## Auth socket (T-002, T-003, T-008)

- Origin validation: exact match of scheme, host, port; missing, opaque,
  malformed, and foreign origins fail closed. Dev-only explicit
  `allowed_origins` override.
- Handoff: host issues ≥128-bit-entropy nonce in a secure HttpOnly
  pre-login session; code is bound to its nonce and atomically redeemed
  with rotation. Length check alone does not establish entropy — generation
  belongs to the host.
- Rate limiting (cross-connection/IP/account) is the product's; kit-level
  length limits complement, never replace it.
- Never place access/refresh tokens into socket results or browser events.
- Hosts must avoid account-existence-oracle responses and apply normal
  CSRF/session checks to bootstrap and handoff endpoints.

## Secrets

`helm/tobor-kit` syncs secrets via InfisicalSecret CRD — no secrets in
chart values or images. LLM provider keys live host-side (Infisical), never
in the lit bundle or CDN artifacts.
