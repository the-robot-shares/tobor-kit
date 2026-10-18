# Backend requirements — tobor-mcp-domain

None required.

This island is host-only. It does not persist policy, talk to MCP servers, or
attach `Authorization`. Events are the persistence API.

`backend`: **none** (kit). There is no domain-visibility resource in
`openapi/tobor-kit.openapi.yaml`. Production Guide API dressing stays in
`elixir/` and `go/` (`GET /mcp/tools`); this admin island is separate.

## What the component does

| Input | Behavior |
|---|---|
| `tools` property | Render a tri-state select per tool |
| `inventory` property | Optional labels + composed `<tobor-tool-list>` of `visible` tools |
| `tool-visibility-change` | Host writes its store |

The island does **not** fetch.

## Host persistence (example, not a kit dependency)

Copy-paste shape used in `examples/{elixir,go,python,rust}/`. Auth, CSRF, and
tenancy stay on the host.

### `GET /mcp/domain`

| | |
|---|---|
| Auth | Host session / bearer — **not** sent by the element |
| `200` | `{tools: {name, visibility}[]}` |
| `401` | Unauthenticated |

Optional `inventory` may be the same payload as `GET /mcp/tools` (already
dressed). The island never calls that route.

### `PATCH /mcp/domain`

Persist `tool-visibility-change`.

| | |
|---|---|
| Body | `{name, visibility}` = event `detail` |
| Auth | Same as GET |
| `200` | `{ok: true, tool: {name, visibility}}` |
| `400` / `422` | Unknown visibility / unknown name — host surfaces the error |
| `401` | Unauthenticated |

Host maps `visible` / `discoverable` / `disabled` onto its allow/deny or menu
overlay. Server-side globs remain the authorization boundary.

## Auth

Not this element's job. Do not put provider keys, session cookies, or bearer
tokens on the tag.

## What the component does not do

- Persist visibility (no `localStorage`, no PATCH)
- Discover or invoke MCP tools
- Redirects, `Set-Cookie`, payment, CSRF
- Authorization headers
- Treat UI visibility as server authorization

## Production vs examples

| Tree | Role |
|---|---|
| Host app | Production persistence |
| `examples/{elixir,go,python,rust}/` | Serve the island + echo GET/PATCH `/mcp/domain` |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
