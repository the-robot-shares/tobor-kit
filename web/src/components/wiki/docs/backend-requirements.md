# wiki family — backend requirements

`backend`: **none** (kit). The **host** loads spaces/entries and persists
`wiki-save`. There is no wiki resource in `openapi/tobor-kit.openapi.yaml`,
and no production tree in `elixir/`, `go/`, or `backend/` for this family.

The elements do not fetch. They emit events; the host owns storage.

## Host contract

| Step | Who | How |
|---|---|---|
| List spaces | Host | Set `tobor-wiki-space.spaces` (`{id, title, slug?}[]`) |
| Open a space | Island → host | `wiki-space-select` `{id}` then host sets `tobor-wiki-entry.entry` |
| Read a page | Host | Set `entry` `{id, title, body, spaceId?}` |
| Start edit | Island → host | `wiki-edit` `{id}` then host sets `tobor-wiki-entry-editor.entry` |
| Persist | Island → host | `wiki-save` `{id, title, body, spaceId?}` — **host writes** |

Body is xhtml-first / NPL **source**. Store and return it as text. Do not ask
the island to parse or sanitize HTML; it never uses `unsafeHTML`.

## Suggested host routes (not a kit API)

Copy-paste shape used in `examples/{elixir,go,python,rust}/`. Production hosts
may use any store (SQL, git, PM wiki). Auth, CSRF, and tenancy stay on the host.

### `GET /wiki/spaces`

| | |
|---|---|
| Auth | Host session / bearer — **not** sent by the element |
| `200` | `{spaces: {id, title, slug?}[]}` |
| `401` | Unauthenticated |

### `GET /wiki/entries/{id}`

| | |
|---|---|
| Auth | Same as list |
| `200` | `{id, title, body, spaceId?}` |
| `401` | Unauthenticated |
| `404` | Unknown id |

### `PUT /wiki/entries/{id}`

Persist `wiki-save`. Empty `id` on the event is a **create** — host assigns
the id (example hosts still echo `PUT` with the client id).

| | |
|---|---|
| Body | `{id, title, body, spaceId?}` = event `detail` |
| Auth | Same as list |
| `200` | `{ok: true, entry: {id, title, body, spaceId?}}` |
| `401` | Unauthenticated |
| `404` | Unknown id (update) |

No secrets on the element. Do not put provider keys, session cookies, or
CSRF tokens on attributes.

## Auth

None on the element. If the host page is behind a session, that session stays
on the host (`credentials: 'same-origin'` on **host** `fetch`, never from the
island).

## What the components do not do

- Redirects, `Set-Cookie`, payment, CSRF
- Fetch spaces or entries
- Persist `wiki-save`
- Token minting or storage
- Parse or render HTML/XHTML/NPL as markup (`unsafeHTML` is not used)
- Compile NPL

## Production trees vs examples

| Tree | Role |
|---|---|
| Host wiki / PM store | Production load + save |
| `examples/html`, `examples/js`, `examples/ts` | Mount the tags, set properties, listen for events |
| `examples/{elixir,go,python,rust}` | Serve the page and stub `GET /wiki/spaces`, `GET /wiki/entries/{id}`, `PUT /wiki/entries/{id}` |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
