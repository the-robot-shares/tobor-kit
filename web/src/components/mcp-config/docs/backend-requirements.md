# Backend requirements — tobor-mcp-config

None required.

This island is host-only. It does not persist config, open MCP transports, or
attach `Authorization`. Events are the persistence API. The host validates.

`backend`: **none** (kit). MCP server URLs and credentials stay on the server
catalog (`elixir/` / `go/` / `backend/`). This admin form is separate.

## What the component does

| Input | Behavior |
|---|---|
| `url`, `transport` | Render the form |
| `extras` | Optional non-secret object, echoed on save when nonempty |
| `config-change` | Host validates and writes its store |

The island does **not** fetch and does **not** probe the URL.

## Host persistence (example, not a kit dependency)

Copy-paste shape used in `examples/{elixir,go,python,rust}/`.

### `GET /mcp/config`

| | |
|---|---|
| Auth | Host session / bearer — **not** sent by the element |
| `200` | `{url, transport, extras?}` |
| `401` | Unauthenticated |

Never return live credentials. If extras exist, omit `env`, tokens, and
Authorization headers (or mask them).

### `PUT /mcp/config`

Persist `config-change`.

| | |
|---|---|
| Body | `{url, transport, extras?}` = event `detail` |
| Auth | Same as GET |
| `200` | `{ok: true, config: {url, transport, extras?}}` |
| `400` / `422` | Invalid URL / unknown transport — **host** surfaces the error |
| `401` | Unauthenticated |

Host-owned validation examples: `http`/`sse` require an `https:` (or
same-origin) URL; `stdio` is a command allowlist on the server. The island
does not enforce this.

## Auth

Not this element's job. Do not put provider keys, session cookies, or bearer
tokens on the tag or in `extras`.

## What the component does not do

- Persist config (no `localStorage`, no PUT)
- Open stdio / Streamable HTTP / SSE
- Redirects, `Set-Cookie`, payment, CSRF
- Authorization headers
- Store or log secrets

## Production vs examples

| Tree | Role |
|---|---|
| Host app | Production persistence + validation |
| `examples/{elixir,go,python,rust}/` | Serve the island + echo GET/PUT `/mcp/config` |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice MCP adapters — **not** this island |
