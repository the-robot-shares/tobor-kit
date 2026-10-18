# Configuration — page-comments family

Tags in this family: `noizu-page-comments` (controller/host), plus the
auto-managed layers `noizu-page-comments-rail`,
`noizu-page-comments-overlay`, `noizu-page-comments-lightbox`, and
`noizu-page-comments-snip`. Hosts only ever place the controller tag; the
layers are appended to `document.body` and torn down by the controller.

## 1. Properties / attributes (`noizu-page-comments`)

| Name | Attr/Prop | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|---|
| `site` | attr | string | yes (HTTP mode) | `''` | no | Site slug threads belong to. Ignored when `dataSource` is injected. |
| `api-base` | attr | URL | no | `https://annotate-srv.therobotlives.com` | no | Annotate service origin. |
| `enabled` | attr | boolean | no | `false` | **yes** | Island on/off. Toggled by the launcher button, Alt+C, `open()`/`close()`/`toggle()`. |
| `rail-mode` | attr | `overlay` \| `push` | no | `overlay` | yes | `push` adds `margin-right: var(--pc-rail-width)` to `<html>` while enabled and restores it on close. |
| `page-key-strategy` | attr | `strip-query-hash` \| `full` | no | `strip-query-hash` | no | How URLs map to thread lists. Default keeps origin + pathname only. |
| `realtime` | attr | boolean | no | `true` | no | Subscribe to live updates over the annotate realtime channel (any data source that implements `connectRealtime`). `false` falls back to fetch-on-write only. |
| `dataSource` | prop | `DataSource` | no | `HttpDataSource` | — | JS-only object property. Inject `MemoryDataSource` for demos/tests. |

## 2. Events (controller tag)

| Event | Detail | When |
|---|---|---|
| `page-comments-toggle` | `{enabled: boolean}` | island toggled (launcher, Alt+C, methods) |
| `page-comments-page-change` | `{pageKey: string}` | SPA navigation produced a new pageKey; threads reloaded |
| `page-comments-thread-create` | `{id: string}` | composer submitted a new thread |
| `page-comments-thread-orphan` | `{id: string}` | a previously anchored thread lost its target |
| `page-comments-auth-change` | `{signedIn: boolean, error: string \| null}` | popup sign-in state changed |
| `page-comments-realtime` | `{type: string, threadId: string \| null}` | a realtime event was folded into the rail (echoes and no-op replays are not emitted) |

Layer-internal events (`pc-*` on the rail/overlay elements) are not a public
surface.

## 3. Methods

| Method | Args | Effect |
|---|---|---|
| `open()` | — | enable the island |
| `close()` | — | disable the island |
| `toggle()` | — | flip `enabled` |
| `refresh()` | — | reload threads for the current pageKey |
| `focusThread(id)` | thread id | focus the card, scroll the anchor into view, draw the ring |

## 4. Slots

None. The island renders no light-DOM content.

## 5. Anchor model (for hosts persisting threads)

`PageAnchor` = `{css, xpath, textQuote: {prefix, exact, suffix},
fingerprint: {tag, textHash, relPos}}` (W3C Web Annotation-style).
`resolve()` tries css → xpath → text-quote search and validates the
fingerprint; a miss everywhere means the thread is **orphaned** and the rail
lists it under “Orphaned” until re-anchored (`PATCH …/anchor`) or the DOM
returns.

## 6. CSS custom properties / parts

| Token | Default | Notes |
|---|---|---|
| `--pc-rail-width` | `360px` | rail width; also the `push`-mode margin |
| `--pc-rail-z` | `2147481000` | rail stacking level |
| `--pc-overlay-z` | `2147480000` | overlay stacking level |
| `--pc-ring-color` | `var(--tobor-kit-accent)` | focused-anchor ring |
| `--pc-picker-color` | `var(--tobor-kit-warn)` | picker hover outline |

The rail/overlay also honor the shared kit tokens (`--tobor-kit-bg`,
`--tobor-kit-surface`, `--tobor-kit-fg`, `--tobor-kit-accent`, …).

Parts: `launcher`, `rail`, `header`, `cards`, `card-body`, `composer`,
`orphan-section`.

## 7. `data-cy` hooks (frozen in `web/registry.yaml`, prefix `comments.`)

| Hook | Layer |
|---|---|
| `comments.launcher` | rail |
| `comments.rail` | rail panel |
| `comments.pick` | rail header “+ Comment” button (enters pick mode; `aria-pressed="true"` while picking) |
| `comments.cards` | cards container |
| `comments.card` | one per thread (`data-thread-id`, `data-orphan`) |
| `comments.card-body` | markdown body of a card |
| `comments.orphan-section` | orphaned threads section |
| `comments.composer-card` / `comments.composer` / `comments.composer-send` / `comments.composer-cancel` | new-thread composer |
| `comments.reply` / `comments.reply-field` / `comments.reply-send` | reply flow |
| `comments.edit` / `comments.edit-field` / `comments.edit-save` / `comments.delete` | comment edit/delete |
| `comments.resolve` / `comments.reopen` / `comments.resolved-badge` | resolution |
| `comments.tab-open` / `comments.tab-resolved` / `comments.tab-all` | rail filter tabs (`aria-pressed`; default Open) |
| `comments.new-pill` | header pill counting unread events on off-screen threads; click focuses the first one |
| `comments.unread-dot` | per-card unread badge (`data-count`, `aria-label`); cleared when the thread is focused |
| `comments.sign-in` / `comments.sign-out` / `comments.close` / `comments.empty` | rail chrome |
| `comments.overlay` rings: `comments.ring` (`data-thread-id`) and `comments.picker-outline` | overlay |
| `comments.attach` / `comments.screenshot` / `comments.screen-capture` / `comments.file-input` | composer attach toolbar |
| `comments.pending-chips` / `comments.pending-chip` (`data-state`, `data-local-id`) / `comments.pending-remove` | composer upload chips |
| `comments.notice` | upload/capture failure notice (`role=alert`) |
| `comments.attachments` / `comments.attachment-image` / `comments.attachment-file` | card + reply attachment lists |
| `comments.annotation-edit` | re-open a stored screenshot annotation |
| `comments.reply-chips` | reply-box screenshot chips |
| `comments.snip-modal` / `comments.snip-cancel` / `comments.snip-apply` / `comments.snip-recrop` / `comments.snip-save` | snip modal stages |
| `comments.crop-rect` / `comments.crop-handle` | crop stage |
| `comments.tool-rect` / `comments.tool-arrow` / `comments.tool-pen` / `comments.tool-text` / `comments.tool-pixelate` | annotate tools (`aria-pressed`) |
| `comments.color` (`data-color`) / `comments.stroke` (`data-width`) | annotate style pickers |
| `comments.undo` / `comments.redo` / `comments.clear` | annotate history |
| `comments.annotate-canvas` / `comments.text-input` | annotate canvas + inline text editor |
| `comments.lightbox` / `comments.lightbox-download` / `comments.lightbox-close` | image viewer |

## 8. Attachments and screenshots

When the injected `dataSource` implements `AttachmentCapableDataSource`
(`HttpDataSource` and `MemoryDataSource` both do), the composer grows an
attach toolbar:

- **Attach** — file picker + drag-and-drop + paste onto the composer card.
  Types are gated client-side against the same allowlist the service
  enforces (png/jpeg/webp/gif/pdf/txt); each upload shows a chip with
  progress, then the posting composer binds the ready ids.
- **Screenshot** — captures the page via `@zumer/snapdom` (optional peer
  dependency), opens the snip modal to crop + annotate (rect/arrow/pen/text/
  pixelate, colors, stroke widths, undo/redo), then uploads the PNG with the
  annotation document stored in `complete` meta. The anchor's bounding rect
  presets the crop when the composer was opened from a pick.
- **Screen capture** — same flow over a `getDisplayMedia` frame; unsupported
  or denied permissions surface a notice instead.
- Posted screenshots render as thumbnails; clicking one opens the
  lightbox (Esc/scrim/✕ close). The **edit** button re-opens the stored
  annotation on a fresh canvas; saving posts a NEW attachment on the reply
  (stored annotations are never mutated).

Without an attachment-capable data source the toolbar never renders —
graceful, not broken.

## 9. Theming / isolation notes

Everything renders in shadow roots; the controller host is
`display: none`. The rail is `pointer-events: none` at the host level with
`pointer-events: auto` on the panel and launcher, so page interaction passes
through the empty band. Below a 900px viewport the rail becomes a bottom
drawer (pure CSS). No host page styles are read or mutated — except the
`push`-mode `<html>` margin described above, which is restored on close and
on disconnect.

## 10. Picking is an explicit mode

Enabling the island shows the rail + launcher only; host clicks pass
through untouched (links, buttons, SPA routers keep working). The rail's
**“+ Comment”** button (or **Alt+Shift+C**) enters pick mode — the only
state where host clicks are captured. Hover outlines the element under the
cursor, a click (or an open text selection) anchors the composer, and a
completed pick, **Esc**, or disabling the island exits pick mode.
**Alt+C** toggles the island itself.

Threads are refetched only on page-change, sign-in/out, and after the
user's own writes; host DOM mutations only re-resolve anchors and relayout
locally. While the island is disabled its DOM/SPA watchers are disposed —
a closed widget never refetches or relayouts.

## 11. Realtime (`realtime` attribute)

With `realtime` enabled (default), the controller asks the data source for a
live subscription while the island is enabled:

- **HttpDataSource** connects a Phoenix WebSocket to
  `{api-base → ws(s)}/socket/annotate`, joins `page:{site}:{sha256hex(page_key)}`
  with `{site, token?}` connect params, and rejoins on page-change and
  sign-in/out. Disabling the island disconnects it (same lifecycle as the
  DOM/SPA watchers — a closed widget holds no socket). Reconnects back off
  exponentially (1 s → 30 s cap, jittered).
- **MemoryDataSource** implements the same optional capability for
  demos/tests: `connectRealtime(pageKey, onEvent)` plus an
  `emitRealtime(event)` driver the demo page exposes as `window.__pcDemo`.
- Incoming events (`thread_created`, `comment_created`, `comment_updated`,
  `comment_deleted`, `thread_resolved`, `thread_reopened`,
  `thread_anchor_updated`) are folded in idempotently — replays and
  reconnect redelivery never duplicate or clobber. Echoes of this client's
  own writes are suppressed by id (once, 30 s window); events naming unknown
  threads trigger one refetch. Anchored threads whose anchor moves re-anchor
  live.
- **Rail polish riding on realtime state:** filter tabs
  **Open / Resolved / All** (default Open), an unread dot on cards with
  unseen events (cleared on focus), and an “N new” header pill when those
  events land on off-screen threads — clicking it focuses the first one.

Hosts wanting fetch-only behaviour set `realtime="false"`.
