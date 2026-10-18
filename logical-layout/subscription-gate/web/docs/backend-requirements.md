# Backend requirements — noizu-subscription-gate

**None required.** The island is a UI gate. The host owns entitlement truth (session, JWT, billing) and may set the `entitled` boolean without any network call.

Optional: `check-url` GET. There is no production tree in this repo’s `elixir/`, `go/`, or `backend/` for this family. `examples/{elixir,go,python,rust}/` show a host serving the page **and** a stub of the optional GET.

The element never sends `Authorization`, API keys, or CSRF fields. It carries no secrets.

## Auth

Same-origin session cookies only (`credentials: 'same-origin'`). No bearer header. Cross-origin `check-url` will not send cookies; proxy on the host origin if the real API is elsewhere.

## Optional GET `check-url`

Fired on connect when `entitled` is false and `check-url` is nonempty. Also re-run when `check-url` changes while not entitled. Skipped when the host already set `entitled`.

```
GET {check-url}
Accept: application/json
credentials: same-origin
```

`{check-url}` is the attribute value as written (relative or absolute). The browser resolves it.

### 200 body

```json
{
  "entitled": true
}
```

| Field | Role |
|---|---|
| `entitled` | Must be boolean `true` to set the property. `"true"`, `1`, missing, or `false` do **not** entitle. |

### Status codes

| Status | Island |
|---|---|
| 200 + `{entitled: true}` | Set `entitled` (reflected). Slot shown. No `gate-blocked`. |
| 200 + other JSON | Stay not entitled. `gate-blocked`. |
| other HTTP status | Stay not entitled. `gate-blocked`. |
| network / abort / invalid JSON | Stay not entitled. Abort is silent (no extra event from the aborted generation). |

The island does **not** treat non-200 2xx as entitled.

## What the component does not do

- Payment, Stripe, or plan changes
- Set-Cookie, `credentials: 'include'`, Authorization headers
- CSRF tokens, JWT minting, or server-side verification
- Redirects unless `auto-redirect` is true **and** `gate-blocked` was not canceled
- Trust the browser property as a security boundary — the host must still authorize on the server

## Events the host MAY handle

| Channel | Name | Detail |
|---|---|---|
| element (bubbles, composed, **cancelable**) | `gate-blocked` | `{redirectTo: string}` |

Default: `auto-redirect` is false. The host listens and navigates (`location.assign`, router, etc.). Call `preventDefault()` to block auto-redirect when that attr is true.

## Production vs examples

| Tree | Role |
|---|---|
| Host app | Entitlement truth (session / billing API) |
| `examples/html`, `examples/js`, `examples/ts` | Mount the tag; host sets `entitled` or listens |
| `examples/elixir`, `examples/go`, `examples/python`, `examples/rust` | Serve the page and optional `GET /entitlement` stub |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
