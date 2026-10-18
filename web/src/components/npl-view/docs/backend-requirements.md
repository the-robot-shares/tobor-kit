# Backend requirements — npl-view family

**None required.**

`<tobor-npl-view>` is a UI island. It does not fetch, persist, or compile NPL.
The **host** sets `source` and may listen for `npl-copy`.

There is no kit HTTP API, WebSocket, cookie header, or production tree
(`elixir/`, `go/`, `backend/`) for this family. The NPL compiler in
`compiler/` is not called from this element.

## What the component does

| Input | Behavior |
|---|---|
| `source` property / attribute | Renders escaped, highlighted, foldable text |
| `npl-copy` | Host may log or persist `{text}`. Island also writes clipboard when available |

## Events the host MAY handle

| Channel | Name | Detail |
|---|---|---|
| element (bubbles, composed) | `npl-copy` | `{text: string}` |

No echo API is required. Examples in `examples/{elixir,go,python,rust}/` only
**serve the page**. Do not copy an NPL compiler into those snippets.

**Do not put secrets, session cookies, or bearer tokens on the element.**

## What the component does not do

- Fetch or compile NPL (`compiler/`, Guide API)
- Persist source (`localStorage`, `PUT`, cookies)
- `Set-Cookie`, CSRF, payment, redirects
- Authorization headers
- Render HTML / Markdown from `source` (`unsafeHTML` is forbidden)
- Treat clipboard write as guaranteed (insecure contexts may lack it)

## Auth

Not this family's job. Never put provider keys, client secrets, or session
cookies on the tag.

## Production vs examples

| Tree | Role |
|---|---|
| Host app | Production load of `source` |
| `examples/{elixir,go,python,rust}/` | Copy-paste: serve the island |
| `examples/{html,js,ts}/` | Mount only |
| `elixir/`, `go/`, `backend/`, `compiler/` in this repo | Guide API / voice / NPL compiler — **not** this family |
