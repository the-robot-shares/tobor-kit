# Backend requirements — noizu-invite-gate

The full contract is the monorepo's `docs/invite-interstitial/PATTERN.md`. This page is
the slice the element depends on.

## Redeem — `POST {endpoint}` (default `/api/v1/invites/redeem`)

```
POST /api/v1/invites/redeem
Content-Type: application/json
Accept: application/json
Authorization: Bearer <accessToken>        # only when the accessToken property is set
credentials: same-origin                    # include with `with-credentials`

{"token": "<raw invite code>"}
```

Must sit in the authenticated pipeline but be **exempt from the invite gate**, and be
rate-limited (it is a token oracle).

| Status | Body | Element state |
|---|---|---|
| 200 | `{"organization_id","organization_name","role","invite_required":false,"organizations":[…]}` | success → `noizu-invite-redeemed` → `continue-url` |
| 404 | `{"error":"Invalid or expired invite token"}` | `invalid` |
| 409 | `{"error":"This invite has already been used"}` | `used` |
| 410 | optional, if the backend distinguishes expiry | `expired` |
| 429 | any | `rate_limited` |
| 401 | any | `unauthenticated` |

A successful redeem flips the account from `pending`/`waitlist` to `active` and grants
membership in one transaction, and is idempotent for members.

## The gate the helpers recognise

Every non-exempt authenticated route answers a gated account with

```
403 {"error":"invite_required","account_status":"pending","message":"…"}
```

and MCP mounts with `403` + `WWW-Authenticate: Bearer …, scope="invite_required", error="insufficient_scope"`.
`auth/me`, register and the SSO responses carry `user.invite_required: boolean`.

## Routes the interstitial needs

The page hosting the element (default `/auth/invite-required`), sign-out, profile and
settings must stay reachable for a gated account. The element carries no secrets and
makes no request other than the redeem.
