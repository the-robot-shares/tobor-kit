# `<noizu-page-comments>`

Page annotation island: a floating comments rail pinned to page anchors, with
an element/text picker, animated anchor rings, orphan tracking across DOM
changes, and popup sign-in against the annotate service. All UI lives in two
shadow-DOM layers appended to `document.body`; the tag itself renders nothing
and never styles the host page (the one exception: `rail-mode="push"` shifts
`<html>` left by the rail width while open).

```html
<noizu-page-comments
  site="my-site"
  api-base="https://annotate-srv.therobotlives.com"
  rail-mode="overlay"
></noizu-page-comments>
```

Quick tour:

- **Launcher / Alt+C** toggles the island; `enabled` reflects state.
- **Picker**: enabling the island never swallows host clicks — links,
  buttons and routers keep working. Press **“+ Comment”** (or Alt+Shift+C)
  to pick: hover outlines the element under the cursor, click selects it
  (an open text selection anchors the range instead). Esc cancels; a
  completed pick opens the composer.
- **Text selection**: selecting text on the page floats a “Comment” pill at
  the selection end — click it, press Alt+Shift+C, or use “+ Comment” to
  open the composer pre-loaded with the quoted excerpt. Selection anchors
  are quote-first and re-resolve to the exact words after a reload
  (orphaned when the quoted text is edited away); the highlight draws one
  ring segment per line.
- **Rail**: thread cards float beside their anchors (Google-Docs collision
  push, `layout.ts`), orphans collect in a bottom section, and below a 900px
  viewport the rail becomes a bottom drawer.
- **Rings**: focusing a card scrolls its anchor into view and pulses a ring
  over it (one rect per `Range.getClientRects()` for text anchors). Hovering
  a ring focuses its card.
- **Threads**: root comment + one-level replies, markdown bodies (sanitized),
  edit/delete, resolve/reopen — through the `DataSource` interface.
  `MemoryDataSource` runs with no backend; `HttpDataSource` speaks the
  annotate contract in `docs/backend-requirements.md`.

Demos: `examples/html/embed.html` (CDN + MemoryDataSource on a page with
dynamic content) and `../../../demo/page-comments.html` (source, used by the
Cypress spec).

Condensed API — full tables in `docs/configuration.md`.

| Attribute | Default | Notes |
|---|---|---|
| `site` | — | site slug (HTTP mode) |
| `api-base` | `https://annotate-srv.therobotlives.com` | annotate service origin |
| `enabled` | off | launcher / Alt+C toggles; reflects |
| `rail-mode` | `overlay` | `overlay` \| `push` |
| `page-key-strategy` | `strip-query-hash` | `strip-query-hash` \| `full` |
| `dataSource` (JS) | `HttpDataSource` | inject `MemoryDataSource` for demos |

Events (all from the host tag): `page-comments-toggle`,
`page-comments-page-change`, `page-comments-thread-create`,
`page-comments-thread-orphan`, `page-comments-auth-change`.

Phase 2a scope: frontend only — the annotate backend is built in parallel and
mocked here. Attachments and page/screen screenshots ARE implemented
(`attachments.ts`, `screenshot.ts`, `annotation.ts`, `snip.ts`, `lightbox.ts`;
presign → PUT → complete contract in `docs/backend-requirements.md`); realtime
channels remain a later phase (`TODO(phase 2b)` in `page-comments.ts` /
`data-source.ts`).
