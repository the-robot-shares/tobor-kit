# Changelog — `@noizu/tobor-kit` (web)

This file starts at 0.1.5; earlier versions are documented by their pull requests.

## 2026-10-17

- **`<noizu-page-comments>`** — text-selection comment flow fix: mousedown-captured selection so opening the composer never
  collapses the selected text (selections were silently degrading to
  element anchors); floating “Comment” pill at the selection end
  (`data-cy="comments.selection-pill"`, Esc dismisses, pointerdown
  prevented, `prefers-reduced-motion` honoured); Alt+Shift+C and “+
  Comment” comment on the live selection instead of entering pick mode;
  `target: "range"` anchors resolve quote-first and re-anchor to the
  exact words after a reload (orphan when the quote is gone); quote
  selectors built from the flat-text model so quotes survive element and
  block boundaries; prefix context no longer leaks into highlights;
  140-char excerpt cap in composer and cards. Unit tests for range
  anchors + 7 Cypress specs over `demo/page-comments.html`; UX review in
  `docs/reviews/2026-10-17-text-anchor-flow.md`.

## 2026-10-14

- **`<noizu-page-comments>`** (`@noizu/tobor-kit/page-comments`, CDN
  `components/page-comments/page-comments.js`) — page annotation island:
  shadow-DOM rail + overlay layers appended to `document.body`, element/text
  picker (Esc cancels, Alt+C toggles), W3C-style anchors (`anchor.ts`: css →
  xpath → text-quote with fingerprint validation, confidence downgrade,
  orphan detection), Google-Docs rail layout (`layout.ts`: focused card
  pinned, 8px min gap, bottom drawer <900px), animated anchor rings per
  `Range.getClientRects()`, SPA page-change tracking
  (pushState/replaceState/popstate), popup auth with in-memory tokens +
  refresh, and a `DataSource` interface with `HttpDataSource` (annotate
  contract; phase 2a mocks the backend) and `MemoryDataSource`. Family ships
  registry entries, `./page-comments.js` export, React wrapper
  `PageComments`, logical-layout symlink, docs, seven-language examples
  (plain-HTML MemoryDataSource demo on a dynamic page), unit tests
  (anchor/layout/markdown/data-source/element) and a Cypress spec
  (pick → create → card aligns ±4px after scroll; ring on focus; orphan on
  DOM removal). PR #83 — audit fixes: watchers disposed on disable,
  single-escape markdown links, disposed-flag page watcher, no refetch on
  host mutations, popup-blocked auth error + closed-popup poll, explicit
  "+ Comment"/Alt+Shift+C pick mode with host clicks passing through,
  measured card heights. PR #84. → realtime (phase 5, PR #86): optional
  `realtime` attr (default on) — `RealtimeSource` over the vendored
  `phoenix` client (WebSocket-only `{api-base}/socket/annotate`, join
  `page:{site}:{sha256hex(page_key)}` with `{site, token?}` params,
  rejoin on page-change/sign-in, disconnect on disable, exponential
  backoff 1s→30s); idempotent event folding (`realtime.ts`) for all seven
  events with own-write echo suppression (id-keyed, once, 30s TTL) and
  unknown-thread refetch; `MemoryDataSource.emitRealtime` simulation for
  demos/tests; rail polish: Open/Resolved/All filter tabs (default Open),
  per-card unread dots cleared on focus, "N new" header pill for off-screen
  threads; parity vector test pins the topic hash
  (`63b1124d…b17f5`); CSP doc adds `wss://annotate-srv.therobotlives.com`.
  → stage, → main (#87/#88).
- **CDN registration gate repair** — #85 shipped the lightbox/snip layer
  tags in their own files without vite entries, leaving the publish-lit
  "tags with no CDN entry" gate red at merge; `components/page-comments/
  {lightbox,snip}.js` now build as entries and self-register alone.

- **`<noizu-page-comments>` attachments + screenshots (phases 3–4)** —
  composer attach toolbar (file picker, drag-and-drop, paste) with
  per-chip upload progress against the presign → PUT → complete contract
  (`AttachmentCapableDataSource` on both `HttpDataSource` and
  `MemoryDataSource`; XHR upload, no auth/credentials on the presigned PUT,
  site as query param), 413/422/403-mapped error chips, client-side
  allowlist gate (png/jpeg/webp/gif/pdf/txt), reply + thread
  `attachment_ids` binding, card thumbnails with a focus-trapped lightbox
  (Esc/scrim/✕). Page screenshot via `@zumer/snapdom` (optional peer) and
  screen capture via `getDisplayMedia`, both flowing into a snip modal:
  crop (8 handles, pointer + keyboard, anchor-rect preset), annotate
  (rect/arrow/pen/text/pixelate, colors, strokes, undo/redo — `annotation.ts`
  pure model with validated `{version, crop, ops}` documents), then upload
  with `{width, height, annotation}` meta; stored annotations re-open for
  editing and save as a NEW attachment on the reply. New modules
  `attachments.ts`, `annotation.ts`, `screenshot.ts`, `lightbox.ts`,
  `snip.ts`, `a11y.ts`; `@zumer/snapdom` vendored for the CDN bundle; new
  unit tests (annotation + attachments) and Cypress flows (attach → post →
  lightbox, paste, rejected type, screenshot → annotate → reply re-edit,
  denied screen capture). PR #85.

## 0.2.0

The invite interstitial ("register open, app gated", monorepo
`docs/invite-interstitial/PATTERN.md`): anyone can sign up, and an account whose domain
needs an invite is held at an interstitial until it redeems one.

### Added

- **`<noizu-invite-gate>`** (`@noizu/tobor-kit/invite-gate`, CDN
  `components/invite-gate/noizu-invite-gate.js`). The interstitial card: explains the
  hold, takes an invite code, `POST`s `{"token"}` to a same-origin `endpoint` (default
  `/api/v1/invites/redeem`; Bearer via the `accessToken` property, or a host `redeemer`
  hook), then emits the cancelable `noizu-invite-redeemed` and navigates to
  `continue-url` (default `/app`). Error states `invalid`, `expired`, `used`,
  `rate_limited`, `unauthenticated` and `failure` are announced in a `role="alert"`
  region tied to the input, and focus returns to the input. Profile and settings links
  and a sign-out button (`noizu-invite-sign-out`, cancelable) stay available. Same
  `--auth-*` theme tokens and pilot `data-cy` hooks as the therobotplans page. React
  wrapper `InviteGate`.
- **`@noizu/tobor-kit/invite-required`**, element-free helpers for any host:
  `handleInviteRequired(response)` and `withInviteGate(fetch)` send a
  `403 {"error":"invite_required"}` (or an MCP `WWW-Authenticate … scope="invite_required"`)
  to the interstitial, without looping when already there; `userNeedsInvite(user)`,
  `isInviteRequiredResponse`, `sameOriginUrl` and the contract constants.
- **`<noizu-auth invite-required-url>`** (default `/auth/invite-required`) and the
  cancelable **`noizu-auth-invite-required`** `{url, source}` event. `source` is
  `register` (account created, `auth-success` already fired) or `register-error` (the
  backend refused with the code; no session was issued).
- `registry.yaml` now lists `invite-fallback-url` (shipped in 0.1.x) on `noizu-auth`.

### Changed

- **An explicit `invite-token-mode="optional"` now opts into the interstitial.** Set as
  an attribute or a property, it adds the hint "have an invite? enter it now — otherwise
  you can add it after signing up." under the field (`text.inviteHint`). A `register`
  answered with `invite_required` (the machine error code — prose alone never matches —
  or a success whose `user` / `session.user` needs an invite) no longer renders an
  error: `auth-success` fires first when the account exists, then the element routes to
  `invite-required-url`. `invite-required-url=""` turns the routing off.
  **Leaving `invite-token-mode` unset keeps the 0.1.x behaviour exactly**; `required`
  and `hidden` are unchanged.

## 0.1.9

### Added

- **`scripts/assert-bundle-side-effects.mjs`** (`npm run test:bundle`), a regression
  gate for the 0.1.7 `sideEffects` fix. It links the built package into a throwaway
  `node_modules`, bundles consumer files that contain only side-effect imports
  (`@noizu/tobor-kit/auth.js` alone, and `auth.js` with `faq`, `footer-brand.js` and
  `guide-panel.js`) with esbuild, which honours `sideEffects`, and asserts that the
  registration call for each expected tag is in the output. With
  `./dist/chunks/*.js` removed from `sideEffects` it fails on both bundles because
  `<noizu-auth>` is missing. It runs in `npm test` after the build and in the
  `publish-lit.yml` build step. `esbuild` is now a direct dev dependency; it was
  already installed through Vite.

No runtime change. The `sideEffects` list already covers every directory the build
emits element code into: entries in `dist/` and `dist/components/*/`, and shared
chunks in `dist/chunks/`. `dist/vendor/` holds only Lit re-exports.

## 0.1.8

### Changed

- **Element registration is idempotent and needs no DOM.** Every element now registers
  through `defineElement` (`src/define.ts`) in place of Lit's `@customElement`. It calls
  `customElements.define(tag, Class)` only when the tag is free and a registry exists.
  Lit's decorator defines unconditionally, so a page that loaded two copies of the kit
  (two CDN shas, or an npm bundle next to a CDN island) threw `NotSupportedError` on the
  second copy and its module import rejected. Now the first definition wins and later
  copies do nothing. Code that runs where there is no registry (a server render, a
  worker, plain Node without Lit's shim) imports the elements without throwing.
  Registration still happens when the module is evaluated, so importing any component
  entry, whether an npm subpath or a CDN `components/<family>/<element>.js`, registers
  its tag. The React wrappers import the same classes and never call `define`, so a
  React consumer does not define anything twice.

### Added

- **`scripts/smoke-cdn-registration.mjs`**, a CDN gate in `publish-lit.yml`. It loads
  each component entry by itself in a fresh headless-Chromium page, so no `index.js`
  import can register the tag on its behalf, and asserts that every tag the entry's
  source declares is defined. It then imports a second copy of the entry from another
  URL (a separate module graph with its own class) and asserts that the import does not
  throw and that the first definition is still registered. It also fails when a
  declared tag has no CDN entry. It fails on a build whose registration call is removed.
- **`scripts/assert-ssr-import.mjs`**, which runs at the end of `npm run build`. It
  imports every npm component entry in plain Node, twice.

### Fixed

- The isolation Cypress spec `e2e/isolation/auth.cy.ts` still asserted the pre-console
  copy ("Welcome back", "Create your account", "Continue"). It now asserts the console
  layout's default copy and switches flows through the `signup-link` / `login-link`
  `data-cy` hooks.

### Note on the therobot.institute report

therobot.institute PR #29 attributed a Sign-in button that did nothing to a CDN
`noizu-auth.js` that "defines nothing". The pinned build (`sha-b8507f6…`) does register
`<noizu-auth>` when it is imported alone in headless Chromium, both on a blank page and
on review.therobot.institute, and its chunk calls `customElement("noizu-auth")`. The
tree-shaking loss fixed in 0.1.7 affects npm bundles only; the CDN files are not
bundled again. This release closes the double-load failure mode and adds the gate, so a
CDN entry that stopped registering would now fail the release.

## 0.1.7

### Added

- **`noizu-auth` custom-method mode**, for a product whose sign-in is neither email nor
  OAuth (therobot.institute's Ed25519 device-key sign-in is the first). The boolean
  `custom-method` attribute, or `pipes = ['custom']`, keeps the card chrome (brand,
  avatar and footer slots, the per-flow title, the close control, the interstitial /
  modal / dropdown shells, native-dialog focus trapping, Escape and `auth-close`) and
  replaces every built-in pipe, the email field and the tabs with a host-slotted pane:
  `method-login`, or `method-signup` (alias `method-register`), each falling back to
  `method`. `flow` picks the pane.
  - The element makes **no network request** in this mode: no `/auth/config` and no
    transport, on either `transport` value. It mounts no `<noizu-human-verify>`.
  - `complete(detail)` fires `auth-success` / `noizu-auth-success` with the host's
    detail unchanged and closes a modal or dropdown. `fail(error)` fires `auth-error` /
    `noizu-auth-error` with `{message, code?}` and shows the message without closing.
  - Slotted content switches flow by dispatching a bubbling `auth-flow-switch`
    `{flow: 'login' | 'signup' | 'register'}`; the element answers with
    `noizu-auth-flow-change` `{flow}`. The React `Auth` wrapper maps it as
    `onFlowChange`.
  - Opening focus lands on the first focusable control in the host's pane.
  - Demo at `demo/auth-custom-method.html`, snippet at
    `src/components/auth/examples/html/custom-method.html`.

### Fixed

- **A bare side-effect import of a kit element could bundle to nothing.**
  `sideEffects` listed `./dist/components/*/*.js` but not `./dist/chunks/*.js`. Vite
  hoists an element's class into a shared chunk whenever another entry imports it too
  (`noizu-auth` lives in `dist/chunks/noizu-auth-*.js`, and the subpath file only
  re-exports it). A bundler that honours `sideEffects` saw the chunk as side-effect
  free, found none of its re-exports used by `import "@noizu/tobor-kit/auth.js"`, and
  dropped it, so `<noizu-auth>` was never defined. An esbuild bundle of that one import
  registered only `noizu-phone-input` before this change and registers `noizu-auth` after
  it. The chunk glob is now listed. The cost is only that a chunk reachable from an
  import is no longer prunable, and every chunk is reached through an element that
  registers itself anyway.

## 0.1.6

### Fixed

- **Three advertised subpaths shipped no JavaScript.** `./footer-brand.js`,
  `./llm-inference.js` and `./llm-inference/catalog.js` were listed in the export map
  and published with type declarations only, because the Vite entry map never named
  them. A consumer importing any of the three got a module-resolution failure at build
  time. They are now built, so `import "@noizu/tobor-kit/footer-brand.js"` registers
  `<noizu-footer-brand>` standalone as the docs have always described.

### Added

- **A build gate for the same class of drift.** `scripts/assert-subpath-entries.mjs`
  runs at the end of `npm run build` and fails when any subpath in the export map has
  no emitted file in `dist` — every target condition, not only `.js`, so a types-only
  entry whose declaration never got emitted is caught too. Wildcard targets cannot be
  checked by existence and are reported rather than skipped in silence. The existing subpath test imports sources, so it could not
  see the gap.

- `noizu-footer-brand` gains coverage for a parent-organization attribution
  (`prefix="a" brand="noizu.com" suffix="project"`) and for the absence of a slot,
  which is what lets a host render the same line in light DOM as pre-upgrade,
  crawlable text.

## 0.1.5

### Changed

- **The console arrangement is now the default layout for `noizu-auth`.** The layout
  itself landed as the opt-in `layout="console"` in #63; this release makes it what
  every consumer gets without asking, in the `pipes` surface and in the legacy
  `options` flow, across `interstitial`, `modal` and `dropdown`. Top to bottom: title
  and subtitle, social providers as icon buttons, an `or` rule, an `email | mobile`
  segmented toggle, the credential form with uppercase labels, a full-width primary
  button, the one-time-code pipes as text links, and a footer offering the opposite
  flow. Each section renders only when the pipes behind it are enabled.

  **Migration:** `layout="tabs"` restores the previous surface — the flat row of pipe
  buttons with the selected pipe's form below it. Nothing about that arrangement
  changed.

- **Legacy `options` flow:** configured providers now render in the social grid from
  the first step, where before they appeared only after a domain policy matched.
  Domain routing itself is unchanged — a mapped domain still routes exclusively to its
  provider with no credential form. `layout="tabs"` restores the old behaviour.

- Default copy is the reference register: `log in`, `sign up`, `choose how you'd like
  to continue`, `or`, `send code`, `verify`, `new here? get started`, `already have an
  account? log in`. The `authentik` pipe reads `Continue with SSO`, since SSO is what
  the person is choosing and Authentik is only how it is implemented. Every string
  remains overridable through `text`, and no key names changed.

### Fixed

- The console never rendered the `merge_required` / `merge_confirming` screens, so a
  backend answering 409 left a dead surface. The merge states now render in every
  layout. This was invisible while the console was opt-in.
- Opening a modal put the focus ring on the close `×`, which was first in DOM order.
  Focus now goes to the first social button, else the first field, and stays armed
  until provider discovery answers so the first field does not win a race the user
  never sees. The `×` renders last and is quiet until hover or focus.
- The console styles keyed off `:host([layout=console])`, which a Lit property default
  never reflects, so making `console` the default would have rendered it unstyled. The
  selectors now key off `:not([layout=tabs])`.
- An OTP-only host rendered a console with no form at all, just a link pointing at the
  form it should already have been showing. Its first code pipe now renders inline, is
  removed from the link row, and still gets the `or` rule above it.

### Added

- `demo/auth.html` — the layout in light and an OLED dark token set, login and signup.
- A `layout` entry in the component configurator schema.

### Notes

- No public API changed. Every property, attribute, event and `data-cy` hook that 0.1.3
  exposed still behaves the same; `layout` is additive and defaults to the new surface.
- The `authentik` pipe resolving against a provider published as `oidc` came in with
  #63 and is what the portfolio backends actually publish.
