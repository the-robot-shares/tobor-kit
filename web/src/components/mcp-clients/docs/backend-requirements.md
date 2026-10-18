# Backend requirements — tobor-mcp-clients

None required.

This island is host-only. It does not persist grants, start OAuth, or attach
`Authorization`. Events are the persistence API. **OAuth redirect is
host-owned.**

`backend`: **none** (kit). Guide API OIDC (`docs/auth-socket.md`,
`elixir/` / `go/` login) is a different flow.

## What the component does

| Input | Behavior |
|---|---|
| `clients` property | Render the roster |
| `client-authorize` `{id}` | Host starts OAuth or collects an API key |
| `client-revoke` `{id}` | Host drops the grant |

The island does **not** fetch and does **not** assign `window.location`.

## Host persistence (example, not a kit dependency)

Copy-paste shape used in `examples/{elixir,go,python,rust}/`.

### `GET /mcp/clients`

| | |
|---|---|
| Auth | Host session / bearer — **not** sent by the element |
| `200` | `{clients: {id, name, status, auth}[]}` |
| `401` | Unauthenticated |

Never return API keys, refresh tokens, or client secrets. Status is enough.

### `POST /mcp/clients/{id}/authorize`

Handle `client-authorize`.

| | |
|---|---|
| Auth | Same as GET |
| `200` (oauth) | `{ok: true, redirect: "https://idp.example/authorize?..."}` — **host** follows `redirect` (full page or popup) |
| `200` (api-key) | `{ok: true}` after the host collected a key in **its** form (not this island) |
| `401` | Unauthenticated |
| `404` | Unknown id |

The element must not be given the authorize URL as an attribute and must not
perform the navigation.

### `POST /mcp/clients/{id}/revoke`

Handle `client-revoke`.

| | |
|---|---|
| Auth | Same as GET |
| `200` | `{ok: true, id}` |
| `401` | Unauthenticated |
| `404` | Unknown id |

## Auth

Not this element's job. Do not put client secrets, API keys, session cookies,
or bearer tokens on the tag.

## What the component does not do

- Redirects (`location.assign`, `href`, meta refresh)
- PKCE / token exchange
- Persist grants
- `Set-Cookie`, payment, CSRF
- Collect or log API keys

## Production vs examples

| Tree | Role |
|---|---|
| Host app | Production persistence, OAuth redirect, key vault |
| `examples/{elixir,go,python,rust}/` | Serve the island + echo GET/POST `/mcp/clients…` (stubs do **not** redirect) |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
