# prompt family — backend requirements

`backend`: **none** (kit). The **host** loads prompts/history and persists
`prompt-star` / `prompt-fork`. There is no prompt resource in
`openapi/tobor-kit.openapi.yaml`, and no production tree in `elixir/`, `go/`,
or `backend/` for this family.

The elements do not fetch. They emit events; the host owns storage.

## Host contract

| Step | Who | How |
|---|---|---|
| List prompts | Host | Set `tobor-prompt-library.prompts` (`{id, title, body, starred?}[]`) |
| Open a prompt | Island → host | `prompt-select` `{id}` then host applies / edits the prompt |
| Filter | Island | `query` matches id / title / body locally. No request. |
| Star / unstar | Island → host | `prompt-star` `{id, starred}` — **host writes** |
| List history | Host | Set `tobor-prompt-history.entries` (`{id, title, at, version?, starred?}[]`) |
| Fork a revision | Island → host | `prompt-fork` `{id}` — **host copies** then may append to `entries` / `prompts` |
| Compare versions | Host | Set `diff` `{left?, right?}` or slot `diff`. Bodies are source text. |

Prompt `body` and diff pane `body` are **source**. Store and return them as
text. Do not ask the island to parse or sanitize HTML; it never uses
`unsafeHTML`.

## Suggested host routes (not a kit API)

Copy-paste shape used in `examples/{elixir,go,python,rust}/`. Production hosts
may use any store. Auth, CSRF, and tenancy stay on the host.

### `GET /prompts`

| | |
|---|---|
| Auth | Host session / bearer — **not** sent by the element |
| `200` | `{prompts: {id, title, body, starred?}[]}` |
| `401` | Unauthenticated |

### `PUT /prompts/{id}/star`

Persist `prompt-star`.

| | |
|---|---|
| Body | `{id, starred}` = event `detail` |
| Auth | Same as list |
| `200` | `{ok: true, id, starred}` |
| `401` | Unauthenticated |
| `404` | Unknown id |

### `GET /prompts/history`

| | |
|---|---|
| Auth | Same as list |
| `200` | `{entries: {id, title, at, version?, starred?}[]}` |
| `401` | Unauthenticated |

### `POST /prompts/{id}/fork`

Persist `prompt-fork`. Host assigns the new id.

| | |
|---|---|
| Body | `{id}` = event `detail` |
| Auth | Same as list |
| `200` | `{ok: true, id, forkedFrom}` |
| `401` | Unauthenticated |
| `404` | Unknown id |

No secrets on the element. Do not put provider keys, session cookies, or
CSRF tokens on attributes.

## Auth

None on the element. If the host page is behind a session, that session stays
on the host (`credentials: 'same-origin'` on **host** `fetch`, never from the
island).

## What the components do not do

- Redirects, `Set-Cookie`, payment, CSRF
- Fetch prompts or history
- Persist `prompt-star` or `prompt-fork`
- Token minting or storage
- Parse or render HTML as markup (`unsafeHTML` is not used)
- Compile NPL

## Production trees vs examples

| Tree | Role |
|---|---|
| Host prompt store | Production load + save |
| `examples/html`, `examples/js`, `examples/ts` | Mount the tags, set properties, listen for events |
| `examples/{elixir,go,python,rust}` | Serve the page and stub `GET /prompts`, `PUT /prompts/{id}/star`, `GET /prompts/history`, `POST /prompts/{id}/fork` |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
