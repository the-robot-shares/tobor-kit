# tobor-chat-thread — backend requirements

`backend`: **elixir** (reference) and **go** (port). Contract:
`openapi/tobor-kit.openapi.yaml`. Mount path `/api/tobor-kit`.

The element does not fetch. Optional transcript I/O is the **same** as
`<tobor-transcript-view>`: the host (or `createBackendStore` from
`transcript-store.ts`) talks to the Guide API. Client-side stores (`memory`,
`local`) never call these routes. Composer `thread-send` is events-up only —
the host POSTs the turn if it wants a server record.

## Endpoints

Base: `/api/tobor-kit`. Session id from `POST /sessions` (host-owned).

### `GET /sessions/{sessionId}/transcript`

List stored turns, oldest first. **Optional.** Without a session/store the
island still renders from `turns` / `messages`.

| | |
|---|---|
| Query | `limit` integer, default `200`, max `1000`; `before` RFC 3339 datetime |
| Auth | Bearer when `auth.required`; otherwise anonymous (optional `X-Client-Id` on Go) |
| `200` | `{turns: Turn[], has_more: boolean}` |
| `401` | `{code, message}` missing/invalid credentials |
| `404` | `{code:"not_found", message}` unknown session (and, on Go, no stored rows) |
| `501` | Guide `transcript.store` is **not** `backend` |

`501` is a **client store**, not an empty transcript and not an error. Map it
to `load = {status: "not_server_backed"}` and leave `turns` / `messages` unused.

Error `code` on 501 (informational; clients key off status):

| Tree | `code` |
|---|---|
| Elixir | `no_backend_transcript` |
| Go | `not_backend_store` |

### `DELETE /sessions/{sessionId}/transcript`

Erase the stored transcript for the session (inner Clear button when `store`
is set).

| | |
|---|---|
| Body | none |
| Auth | Same as GET |
| `204` | Erased (no body) |
| `401` | Missing/invalid credentials |
| `404` | Unknown session / no stored transcript (Go MemoryStore) |
| `501` | Client store (`memory` / `local`) |

`ToborKitClient.deleteTranscript` treats 501 as `{supported: false}` and does
not throw. The inner view still clears local `turns` after `store.clear()`;
this element then clears `messages` as well.

### `POST /sessions/{sessionId}/turn` (host-owned, not called by this tag)

`thread-send` `{text}` is **not** a network call. Hosts that persist the
composer should POST the Guide API turn stream themselves (see
`tobor-guide-panel`). This family does not open SSE.

## Auth

- Bearer access token from the guide OIDC flow (`GET /guide` → `auth.issuer` +
  `auth.client_id`). This API has no `/auth` routes.
- Hosts verify tokens. The element carries **no secrets**, no provider keys,
  no session cookies.
- When `auth.required` is false, session routes accept unauthenticated callers.

## What the component does not do

- Redirects, `Set-Cookie`, payment, CSRF
- `POST /sessions`, `POST /sessions/{id}/turn`, `GET /guide`
- Token minting or storage
- Fetch or parse HTML in messages (`unsafeHTML` is not used)
- Re-applying `mcp.menu` or writing prompt context

## Production trees vs examples

| Tree | Role |
|---|---|
| `elixir/` | Reference. `ToborKit.Transcript` behaviour; shipped `Transcript.Memory` has `backend?/0 == false`, so both transcript routes **501** until a host supplies a backend impl. Router: `elixir/lib/tobor_kit/endpoint.ex`. |
| `go/` | Port. Endpoints 501 unless `guide.transcript.store == "backend"` and a `transcript.Store` is wired. `go/internal/transcript`, `go/internal/server`. |
| `examples/` | Host mount snippets. They **call** these routes; they do not reimplement the store. |

`createBackendStore(client, sessionId)` → `GET` on `load()`, `DELETE` on
`clear()`, `append()` is a no-op (`writable: false`). `storeForGuide` picks
`memory` / `local` / `backend` from the projection's `transcript.store`.
