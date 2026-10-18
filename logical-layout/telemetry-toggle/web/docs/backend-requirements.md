# tobor-telemetry-toggle — backend requirements

Guide API consent resource. Contract: `openapi/tobor-kit.openapi.yaml`.
Elixir is the reference (`elixir/`); Go is a port (`go/`). Examples in this
family **call** those trees — they do not reimplement them.

Base path: `/api/tobor-kit` (OpenAPI `servers`).

## Auth

Bearer access token (`Authorization: Bearer …`) from the guide's OIDC flow.
Login is client-initiated; this API defines no `/auth` routes. The element
never holds a refresh token, session cookie, or provider key.

When `auth.required` is true, unauthenticated `GET`/`PUT /telemetry/consent`
answers **401** `{code:"unauthorized", message:"Missing or invalid credentials."}`.
`GET /guide` stays open. Hosts pass `client.token` (string or thunk); do not
put secrets on the tag.

When auth is not required, backends bind the record to an anonymous identity
(Elixir: `anonymous:` + `x-tobor-client` or a connection fingerprint; Go: opaque
client id). The element does not set `x-tobor-client`.

## `GET /telemetry/consent`

Resolved consent for the caller. The element fetches this on connect when
`client` is set and `consent` is omitted.

**Request:** none.

**200** `TelemetryConsent`:

```json
{
  "enabled": true,
  "source": "user",
  "user_overridable": true,
  "capture": {
    "prompt": true,
    "response": true,
    "tool_args": false,
    "tool_results": false
  }
}
```

| `source` | Meaning |
|---|---|
| `user` | Explicit preference on record |
| `default` | Never expressed; guide `telemetry.default` applied |
| `forced` | No user choice: `telemetry.enabled: false` (master off) or `user_overridable: false` |

`user_overridable` is false whenever `source` is `forced`. Either signal is
enough for the element to render nothing.

**401** — missing/invalid credentials when `auth.required`.

The client throws `ToborKitError`; the element shows the load-error notice.

## `PUT /telemetry/consent`

Record the caller's explicit preference. Body required:

```json
{"enabled": true}
```

**200** — preference recorded; body is the resolved `TelemetryConsent`
(`source` becomes `"user"`). The element assigns it and fires
`tobor-telemetry-change`.

**403** — the default is binding. The client should not have rendered a
toggle. Body `{code, message}`:

| Tree | `code` |
|---|---|
| Elixir | `not_overridable` |
| Go | `consent_not_overridable` |

`ToborKitClient.setTelemetryConsent()` maps any 403 to
`{ok:false, reason:"forbidden"}` (it does not throw). The element **reverts to
inert** (`source: "forced"`, `user_overridable: false`) and fires
`tobor-telemetry-change` with that consent, then renders nothing.

**400** — missing/non-boolean `enabled` (`bad_request` Elixir,
`invalid_request` Go).

**401** — as for GET.

## What the element does not do

- Redirects, `Set-Cookie`, CSRF, payment
- Token mint/refresh or IdP calls
- Local persistence of consent (no `localStorage`)
- OpenTelemetry export (spans live in `elixir/` / `go/`; content attributes
  attach only when resolved consent is on, then `telemetry.redact[]` still runs)
- Inventing a default while the server is unreachable (it shows an error or
  nothing, never a guessed toggle)

## Production vs examples

| Tree | Implementation |
|---|---|
| `elixir/lib/tobor_kit/components/telemetry/` | Consent resolve/put |
| `elixir/lib/tobor_kit/endpoint.ex` | `GET`/`PUT /api/tobor-kit/telemetry/consent` |
| `go/internal/telemetry/` | Consent resolve/record |
| `go/internal/server/server.go` | Same routes on `server.BasePath` |

Host mount: Elixir `forward "/api/tobor-kit", to: ToborKit.Endpoint`; Go
`server.New(cfg)` as the `/api/tobor-kit/` handler. Snippets under `examples/`
only serve the tag.

Swift UI is out of this family folder; it consumes the same JSON.
