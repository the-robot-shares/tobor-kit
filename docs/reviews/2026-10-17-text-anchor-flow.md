# UX Review — page-comments text-selection comment flow

Date: 2026-10-17 · Family: `page-comments` · Branch: `fix/page-comments-text-anchor` · Trigger: user report — "highlight text to comment flow doesn't work right."

## What the flow should do

Select text on the host page → a floating "Comment" pill appears at the selection end → click it (or press Alt+Shift+C, or the rail's "+ Comment") → the composer opens pre-loaded with the quoted excerpt → the posted thread shows the quote and a per-line highlight over exactly the selected words — on this page load and after a reload.

## Problems found (ranked by user impact)

1. **Text selections were silently converted to element anchors.** Any mousedown on the rail collapsed the page selection before the click handler read it (shadow-DOM layer is a separate document surface; the press clears the host selection). The click then fell back to `elementFromPoint` anchoring, so "highlight these words" produced a whole-element comment with no quote at all. *Fix:* snapshot a clone of the live selection on `mousedown` (capture phase, before the browser collapses it) and prefer it over element picking.
2. **No floating affordance.** There was no pill; the only entry points were the rail button (which lost the selection, see 1) and Alt+Shift+C (which entered element-pick mode and hit the same loss at the pick click). *Fix:* overlay-rendered pill positioned at the selection's last line rect (flips above near the viewport bottom, clamps clear of the open rail), `pointerdown` prevented so clicking it never steals the selection, Esc dismisses, keyboard focusable, animation honours `prefers-reduced-motion`.
3. **After a reload, range anchors degraded to their containing element.** Element-anchored resolution won ties against quote resolution, so a previously line-precise highlight re-appeared as one large box around the whole paragraph. *Fix:* anchors created from a selection now carry `target: "range"`; resolution is quote-first for them and returns the resolved `Range` directly — quote gone means orphaned, never an element fallback.
4. **Quotes broke across element/block boundaries.** `Range.toString()` mashes words at boundaries (`…with<br>selecting` → `withselecting`, `</p><p>` → `about.The second`), so stored quotes could never re-match the page's normalized text. *Fix:* `exact`/`prefix`/`suffix` are now read from the same whitespace-collapsed flat-text model the resolver searches, mapped back to original-case raw text.
5. **Prefix context leaked into the highlight.** The quote resolver's `[prefix, exact]` disambiguation attempt returned the span from the *prefix* start, so highlights could include extra leading words. *Fix:* attempts declare prefix/suffix segments as context — located for disambiguation, excluded from the returned span.
6. **Alt+Shift+C ignored the selection.** It unconditionally entered pick mode. *Fix:* with a live selection it opens the composer on the quoted text directly (with a synchronous live-selection read so the shortcut never races the selectionchange frame).
7. Smaller polish: composer/card excerpts are capped at 140 chars (previously unbounded); selections inside widget shadow layers are excluded; ring + pill animations respect `prefers-reduced-motion`; registry gains `comments.selection-pill`.

## What changed

- `web/src/components/page-comments/page-comments.ts` — selection capture (`selectionchange` + rAF debounce, mousedown snapshot), selection pill, `#beginComment` path (rail button, pill, Alt+Shift+C), excerpt truncation, rail empty-state copy, overlay pill styles.
- `web/src/components/page-comments/anchor.ts` — `target: "range"` anchors with quote-first resolution, flat-text-derived quote selectors (boundary-safe), context-aware `findParts`.
- Tests: 22 unit tests for range anchors (round-trip, markup reshuffle, mid-quote edit recovery, orphan, whitespace drift, prefix disambiguation) + 7 Cypress specs over the demo fixture (pill lifecycle, Esc, all three entry points, per-line rings, reload re-anchor, orphan). Full browser suite 552 passing; Cypress 24 passing.

## Known limitations / follow-ups

- Overlap with an existing highlight is not merged or deduped; two threads quoting the same words stack rings.
- The reload test re-feeds the stored anchor through a simulated realtime event; a persistence-backed e2e (real data source) would be a stronger guarantee later.
- Review screenshots were not captured in this pass.
