# tobor-review-panel — backend requirements

**None required.**

`<tobor-review-panel>` does not call a server, the Guide API, or any kit route. The **host** loads reviews into the `reviews` JS property and persists `review-submit` / `review-resolve`. There is no production tree in `elixir/`, `go/`, or `backend/` for this island.

## Host-owned reviews

Set `el.reviews` (property-only) after a host read. Typical source: the host's own artifact API. The element never fetches.

```json
{
  "reviews": [
    {
      "id": "r1",
      "author": "Ada",
      "body": "Looks good",
      "at": "2026-01-01T00:00:00.000Z",
      "status": "open"
    }
  ]
}
```

| Field | Host meaning |
|---|---|
| `id` | Stable review id (emitted on resolve) |
| `author` | Display name |
| `body` | Review text |
| `at` | Optional ISO timestamp |
| `status` | `open` (default) or `resolved` |

Do **not** put API keys, session cookies, or bearer tokens on the element.

## Suggested host routes (not a kit API)

Optional echo used in `examples/{elixir,go,python,rust}/`. Production hosts persist however they store artifacts. Paths below are **host** routes — they are not in `openapi/tobor-kit.openapi.yaml`.

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| `GET` | `/artifacts/{artifactId}/reviews` | — | `200` `{reviews: Review[]}` | `401` unauthenticated, `404` unknown artifact |
| `POST` | `/artifacts/{artifactId}/reviews` | `{body: string}` | `201` `{id, author, body, at, status}` | `400` empty body, `401`, `404` |
| `POST` | `/artifacts/{artifactId}/reviews/{id}/resolve` | empty / `{}` | `200` `{id, status: "resolved"}` | `401`, `404` |

Page JS then replaces `el.reviews` from `GET`. The island does not append locally.

`<tobor-artifact-view>` `review-start` is the usual entry: the host opens this panel for that artifact and GETs the list. This family does not listen for `review-start`.

## Auth

None on the element. If the host page is behind a session, that session stays on the host (`credentials: 'same-origin'` on **host** `fetch`, never from the island). Never put a bearer secret on the tag.

## What the component does not do

- Fetch or persist reviews
- Redirects, `Set-Cookie`, payment, CSRF
- JWT minting or `credentials: 'include'`
- Server-side verification of authorship
- Mutate `reviews` after submit/resolve
- Handle `review-start` from artifact-view

## Examples vs production

| Tree | Role |
|---|---|
| Host artifact API | Production load + save |
| `examples/html`, `examples/js`, `examples/ts` | Mount the tag, set `.reviews`, listen for events |
| `examples/{elixir,go,python,rust}` | Serve the page and stub the three host routes |
| `elixir/`, `go/`, `backend/` in this repo | Guide API / voice — **not** this island |
