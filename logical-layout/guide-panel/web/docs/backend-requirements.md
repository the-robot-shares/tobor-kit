# tobor-guide-panel — backend requirements

The panel is a UI island over the Guide API in
`openapi/tobor-kit.openapi.yaml`. It talks HTTP only through `ToborKitClient`
(`web/src/client.ts`). Mounted at `/api/tobor-kit`.

## Production trees

Do **not** reimplement this service in a host or in `examples/`.

| Tree | Role |
|------|------|
| `elixir/` | Reference: Plug + Bandit (`ToborKit.Endpoint`, `ToborKit.HTTP`). |
| `go/` | Port: `go/internal/server` (`BasePath = /api/tobor-kit`), `go/cmd/tobor-kit-go`. |

Run those processes and point `base-url` at them, or reverse-proxy the prefix.
Examples in this family **call** these routes.

## Auth

Optional `Authorization: Bearer <access_token>` from the host session. The
panel never holds a provider API key, never sets cookies, and does not run
OIDC itself (`tobor-login-flow` is a sibling). When `auth.required` is false,
session routes accept unauthenticated callers.

`GET /guide` is public (`security: []`).

## Endpoints the panel uses

### `GET /guide` — config projection only

UI-facing projection. **Never** contains the compiled NPL preamble, biography,
provider model ids, or credentials.

| | |
|--|--|
| Request | no body |
| 200 | `GuideProjection` (`slug`, `name`, `ui`, `modes`, `auth`, `telemetry`, `voice`, `transcript`, …) |
| 404 | no guide loaded |

The panel fetches this on connect unless `guide` was set. Missing fields follow
`schema/tobor.guide-definition.schema.yaml` defaults.

### Sessions

| Method | Path | Request | Success | Errors |
|--------|------|---------|---------|--------|
| `POST` | `/sessions` | `{resume_id?, locale?, client?: web\|ios\|macos\|other}` | 201 `Session` | 401 |
| `GET` | `/sessions/{sessionId}` | — | 200 `Session` | 404 |
| `DELETE` | `/sessions/{sessionId}` | — | 204 | 404 |

The panel opens a session lazily on the first turn (`client: "web"`).

### `POST /sessions/{sessionId}/turn` — SSE

Body: `{input, task_id?, idempotency_key?}`. `task_id` is advisory (task-menu
selection). Response is `text/event-stream`:

| event | data |
|-------|------|
| `state` | `{"state": "<GuideState>"}` |
| `delta` | `{"text": "..."}` |
| `tool_call` | `{"id", "name", "args"?}` |
| `tool_result` | `{"id", "ok", "summary"?}` |
| `message` | terminal assistant `Turn` |
| `error` | `{"code", "message"}` |

A stream **always** terminates with exactly one `message` or one `error`. The
client raises synthetic `stream_incomplete` if the stream closes without
either, so the avatar never spins forever.

HTTP before streaming: 401, 409 (turn in flight), 429. Failures after headers
are `error` frames, not HTTP statuses.

### `GET /mcp/tools` — `listTools`

Live MCP inventory, already filtered and `mcp.menu`-dressed server-side.
Clients render verbatim. Query `refresh=true` bypasses cache.

| | |
|--|--|
| 200 | `{groups, tools, degraded?}` |
| 401 | unauthorized |
| 502 | a `required` MCP server is down |

The panel loads this when the projection shows the task menu or tool list.
Fetch failure becomes an empty inventory (`degraded: []`), not a hard error.

### `POST /voice/token`

Minted by the embedded voice session, not the panel itself.

| | |
|--|--|
| 201 | `VoiceCredential` (`realtime` or `backend`) |
| 409 | adapter needs no credential (`native`) — success shape, not a throw |
| 503 | voice disabled / provider unconfigured |

Tokens are short-lived. The browser never holds a provider API key.

### Telemetry

Embedded `tobor-telemetry-toggle`.

| Method | Path | Body | Success | Errors |
|--------|------|------|---------|--------|
| `GET` | `/telemetry/consent` | — | 200 `TelemetryConsent` | 401 |
| `PUT` | `/telemetry/consent` | `{enabled: boolean}` | 200 | 403 when `user_overridable` is false (or telemetry forced off) |

A 403 toggle is inert. Content is logged only when consent resolves `on`.

### Transcript

Used when `transcript.store` is `backend` (via `storeForGuide`).

| Method | Path | Success | 501 |
|--------|------|---------|-----|
| `GET` | `/sessions/{sessionId}/transcript` | `{turns, has_more}` | client-side store (`memory` / `local`) |
| `DELETE` | `/sessions/{sessionId}/transcript` | 204 | same |

501 is **not** an empty transcript and **not** an error. The transcript view
renders a dedicated not-server-backed notice.

## What the component does not do

- Redirects, `Set-Cookie`, CSRF, payments
- NPL compilation or preamble delivery
- MCP allow/deny / menu overlay (server-side only)
- Provider calls, budget, OIDC token exchange
- Trusting the client for anything the host must verify

## Error envelope

`{code, message, detail?}`. The panel surfaces `guide_unavailable`,
`turn_failed`, stream `error` codes, and `stream_incomplete`.
