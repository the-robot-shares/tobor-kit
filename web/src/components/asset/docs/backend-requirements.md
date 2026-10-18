# Backend requirements — asset family

The kit does **not** persist assets. `<tobor-asset-view>` and `<tobor-asset-editor>` never `fetch`, `PUT`, or write `localStorage`. There is no production tree in `elixir/`, `go/`, or `backend/` for this family.

The **host** loads asset records and sets the `asset` JS property. The **host** persists `asset-save`.

## Load (host)

Set `el.asset` (property-only) after the host reads its own store. Typical source: a host `GET` behind the host session. The element never fetches.

```json
{
  "id": "note-1",
  "name": "readme.txt",
  "mime": "text/plain",
  "src": null,
  "body": "Hello from the host.",
  "meta": {}
}
```

| Field | Host meaning |
|---|---|
| `id` | Stable identity |
| `name` | Filename / title |
| `mime` | Preview routing (`image/*`, `text/*`, other) |
| `src` | Image URL or download href (host-authored; no secrets) |
| `body` | Inline text for `text/*`. Omit for binaries |
| `meta` | Optional host bag; not rendered |

Do **not** put signed cookies, API keys, or HTML documents meant to be executed on the element. `text/*` bodies are shown as escaped text.

## Save (host)

The editor emits `asset-save` `{id, name, body?}` (bubbles, composed). `body` is included only when `mime` is `text/*`. The **host** writes its store. The element does not persist.

Optional echo used in `examples/{elixir,go,python,rust}/` (not a kit API):

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `GET` | `/assets/:id` | — | `200` asset JSON | `404` unknown id |
| `PUT` | `/assets/:id` | JSON `{id, name, body?}` | `200` `{ok: true, asset: <body>}` | `400` invalid JSON, `401` unauthenticated |

Page JS assigns `GET` JSON to `.asset` and `PUT`s `asset-save` `detail`. Production hosts own auth, CSRF, validation, and blob storage. Never embed provider secrets in snippets or attributes.

## Auth

None on the element. If the host page is behind a session, that session stays on the host (`credentials: 'same-origin'` on **host** `fetch`, never from the island).

## What the components do not do

- Persist (HTTP, `localStorage`, IndexedDB, cookies)
- Inject HTML from `body` / `meta` (`unsafeHTML` is forbidden)
- Redirect, `Set-Cookie`, CSRF, JWT, or `credentials: 'include'`
- Talk to S3/CDN APIs or sign URLs
- Treat `verified` / mime as a security boundary — host still sanitizes stored files

## Events the host MAY handle

| Channel | Name | Detail |
|---|---|---|
| element (bubbles, composed) | `asset-open` | `{id}` — optional open |
| element (bubbles, composed) | `asset-save` | `{id, name, body?}` — host persists |

## Examples vs production

| Tree | Role |
|---|---|
| Host asset store | Production load + save |
| `examples/html`, `examples/js`, `examples/ts` | Mount both tags, set `.asset`, listen for events |
| `examples/{elixir,go,python,rust}` | Serve the page and stub `GET`/`PUT /assets/:id` |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
