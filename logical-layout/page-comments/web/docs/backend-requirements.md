# Backend requirements — `<noizu-page-comments>`

`backend: external`. Phase 2a is **frontend-only**: the annotate service
(`annotate-srv.therobotlives.com`) is being built in parallel and is mocked
in this repo by `MemoryDataSource`. The production service is **not**
implemented in this repo's `elixir/`, `go/`, or `backend/` trees.

## Transport rules

- Every request: `mode: 'cors'`, `credentials: 'omit'`,
  `Accept: application/json`, JSON bodies.
- Auth is a **bearer token held in memory only** (`Authorization: Bearer …`),
  obtained through the popup flow below. The element never sets cookies and
  never reads host session cookies. Do not set
  `Access-Control-Allow-Credentials: true`; `Access-Control-Allow-Origin`
  may be `*` for anonymous routes, but must echo the origin for authed ones.
- Host-owned concerns (redirects, Set-Cookie, the IdP itself, CSRF) stay out
  of the widget.

## CSP notes for host pages

- `script-src` must include `https://cdn.derobot.is` (kit CDN).
- `connect-src` must include `https://annotate-srv.therobotlives.com` and
  `wss://annotate-srv.therobotlives.com` (same host: REST + realtime socket).
- If embedding the login popup page from another origin, its own CSP is that
  page's concern; the widget only `window.open`s it and listens for
  `postMessage`.

## Endpoints

Base: `{api-base}` (default `https://annotate-srv.therobotlives.com`),
`{site}` is the site slug.

| Method + path | Request | Response / errors |
|---|---|---|
| `GET /api/v1/sites/{site}/threads?page_key={pageKey}` | — | `200` `{threads: CommentThread[]}` · `401` · `403` |
| `POST /api/v1/sites/{site}/threads` | `{page_key, url, title, anchor, body_md, attachment_ids?}` | `201` `CommentThread` · `400` · `401` |
| `POST /api/v1/threads/{id}/comments` | `{body_md, parent_id?, attachment_ids?}` | `201` `CommentReply` · `404` |
| `PATCH /api/v1/comments/{id}` | `{body_md}` | `200` · `403` (not owner) · `404` |
| `DELETE /api/v1/comments/{id}` | — | `204` · `403` · `404` |
| `POST /api/v1/threads/{id}/resolve` | — | `200` · `404` |
| `POST /api/v1/threads/{id}/reopen` | — | `200` · `404` |
| `PATCH /api/v1/threads/{id}/anchor` | `{anchor: PageAnchor}` | `200` · `422` (anchor invalid) |
| `POST /api/v1/token/refresh` | Bearer refresh token | `200` `{access_token, expires_at, refresh_token?}` · `401` |

`CommentThread`:
`{id, page_key, url, title?, anchor, body_md, resolved?, author?, created_at?, comments: CommentReply[], attachments?: Attachment[]}`
— `CommentReply`: `{id, thread_id?, parent_id?, body_md, author?, created_at?, attachments?: Attachment[]}`.
`anchor` is the `PageAnchor` object described in `docs/configuration.md` §5.

## Attachments (presigned upload)

Three-step flow; the browser never holds object-store credentials:

1. `POST /api/v1/attachments/presign?site={site}`
   `{filename, content_type, bytes, kind: file|image|screenshot}` →
   `201 {attachment: Attachment, upload_url}` — `upload_url` is a presigned
   PUT. Site travels as a query param because preflight OPTIONS requests
   cannot carry `Authorization`.
2. Browser `PUT`s the raw bytes to `upload_url` (XHR for progress). **No**
   `Authorization` header, `credentials: omit`, header set exactly as the
   presign returned (default: just `Content-Type`).
3. `POST /api/v1/attachments/{id}/complete?site={site}`
   `{width?, height?, annotation?}` → `200/201 Attachment` (ready).

Rules the service enforces and the UI mirrors: allowlist
png/jpeg/webp/gif/pdf/txt; `bytes > 0` and ≤ `max_upload_mb` (else `413`);
`kind ∈ file|image|screenshot`; only the uploader may complete (else `403`);
repeat complete → `409 not_pending`; `attachment_ids` on thread/reply must be
own + ready + unbound + same-site (else `422 attachment_mismatch`).

`Attachment`: `{id, filename, content_type, bytes, kind, width?, height?,
annotation?, url, created_at?, status}` — `url` is a presigned GET the UI
uses directly for `<img>`/download. `annotation` is the stored screenshot
document `{version: 1, crop, ops}` (`docs/configuration.md` §8); the UI
re-opens it read-only-plus-resave (edits always produce a NEW attachment).

CSP: hosts additionally need `img-src`/`connect-src` entries for the
object-store origin that serves `upload_url`/`url` (MinIO/S3 presigned
hosts), not just `annotate-srv`.

## Auth popup

1. Widget opens `{api-base}/embed/login?site={site}&origin={page origin}`.
2. The login page completes the host IdP dance **server-side** and
   `postMessage`s to `origin`:
   - success: `{type: 'annotate-auth', access_token, expires_at, refresh_token?}`
   - failure: `{type: 'annotate-auth-error', error}`
3. The widget accepts messages only from the `{api-base}` origin, keeps the
   token in memory, and refreshes via `POST /api/v1/token/refresh` about a
   minute before expiry.

## Realtime channel (phase 5)

When the widget is enabled it opens a Phoenix socket and joins one topic per
page; the client never renders raw payloads — it folds each event into local
state idempotently (see `realtime.ts`), so replays and reconnect redelivery
are safe.

1. **Socket** — `wss://annotate-srv.therobotlives.com/socket/annotate`
   (`{api-base}` with the scheme swapped to `ws(s)`), WebSocket-only
   transport. Connect params: `{site, token?}` (`token` = access token when
   signed in; the backend may use it to authorize reads/writes on the topic).
2. **Topic** — `page:{site_slug}:{sha256hex(page_key)}`. `site` is the raw
   slug (NOT URL-encoded), `page_key` follows the component's
   `page-key-strategy` (default `strip-query-hash`: origin + pathname, any
   trailing `/` collapsed). Parity vector pinned in tests:
   `sha256("phase5-parity-vector") =
   63b1124d51c9c48fe33623ab2755b4959deaf5bdb2d4426a002c24ddb52b17f5`.
3. **Events on the topic** —
   - `thread_created` → `{thread: <CommentThread>}`
   - `comment_created` / `comment_updated` → `{thread_id, comment: <CommentReply>}`
   - `comment_deleted` → `{thread_id, comment_id}`
   - `thread_resolved` / `thread_reopened` → `{thread_id}`
   - `thread_anchor_updated` → `{thread_id, anchor}`
   Payload envelopes may also be flat (`{id, thread_id, anchor, ...}`); the
   client parser tolerates both. Senders must emit to OTHER sessions — the
   client suppresses echoes of its own writes by id (once, 30 s window) and
   refetches the thread list if an event names an unknown thread.
4. **Lifecycle** — the client (re)joins on enable, page change, and
   sign-in/out; it disconnects when the island is disabled. Reconnect uses
   exponential backoff (1 s → 30 s cap, jittered).

## What the component does NOT do

No redirects, no cookie/CSRF handling, no payments, no server-side
verification. Comment ownership
(edit/delete) is enforced server-side; the UI affordances are not an
authorization boundary. Attachments and page/screen screenshots ARE
implemented client-side (above); the service must exist for them to work,
and the toolbar hides itself behind an attachment-capable data source.

## Which tree implements it

None yet — the annotate service is parallel work. The `examples/` stubs show
a demo host serving the page and (optionally) a minimal echo of this
contract for local development; they do not implement the production
service.
