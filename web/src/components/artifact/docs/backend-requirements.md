# Backend requirements — artifact family

**None required.**

`<tobor-artifact-view>` and `<tobor-artifact-editor>` are UI islands. They do
not fetch, persist, bump versions, or start reviews. The **host** loads
`artifact`, writes on `artifact-save`, and handles `review-start`.

There is no kit HTTP API, WebSocket, cookie header, or production tree
(`elixir/`, `go/`, `backend/`) for this family.

## What the components do

| Input | Behavior |
|---|---|
| `artifact` property | View renders title / version / mime / body as text. Editor seeds drafts. |
| `review-start` | Host opens a review for `{artifactId, version}`. |
| `artifact-save` | Host creates or updates the record. Kit does not write. |

## Events the host MUST persist (if it wants a store)

| Channel | Name | Detail |
|---|---|---|
| element (bubbles, composed) | `artifact-save` | `{id, title, body, version?}` |
| element (bubbles, composed) | `review-start` | `{artifactId, version}` |

`version` on save is the **current** seed, not a bumped value. The host chooses
the next version and assigns a new `artifact` object onto the elements.

## Optional echo used in examples (not a kit API)

Examples in `examples/{elixir,go,python,rust}/` serve the page and echo an
in-memory store. Production hosts replace this with their own API, auth, and
CSRF. Do not copy the echo into `elixir/` or `go/` in this repo.

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `GET` | `/artifacts/{id}` | none | `200` `{id, title, version, body, mime?}` | `404` `{error: "not found"}` |
| `PUT` | `/artifacts/{id}` | JSON `{id?, title, body, version?}` | `200` stored record (host bumps `version`) | `400` invalid JSON |
| `POST` | `/reviews` | JSON `{artifactId, version}` | `200` `{ok: true, review: <body>}` | `400` invalid JSON |

No auth on the echo. Examples skip CSRF. Production hosts own CSRF, auth,
authorization, and durable storage.

**Do not put secrets, session cookies, or bearer tokens on the element.**
`GET`/`PUT` in the snippets use `credentials: 'same-origin'` from **host**
script, not from the island.

## What the components do not do

- Persist artifacts (`localStorage`, `PUT`, cookies)
- Bump `version`
- `Set-Cookie`, CSRF, payment, redirects
- Authorization headers
- Render HTML / Markdown / images from `body` or `mime`
- Treat `review-start` as a completed review

## Auth

Not this family's job. Never put provider keys, client secrets, or session
cookies on the tags.

## Production vs examples

| Tree | Role |
|---|---|
| Host app | Production load + persist + review |
| `examples/{elixir,go,python,rust}/` | Copy-paste: serve the islands + echo GET/PUT/POST |
| `examples/{html,js,ts}/` | Mount only (in-memory / console) |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice / auth — **not** this family |
