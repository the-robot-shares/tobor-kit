# review-panel — Hologram mirror (wave 4)

Mirror of `web/src/components/review-panel/review-panel.ts`
(`tobor-review-panel`) → `ToborKit.Hologram.Review.Panel` (contract class B:
snapshot list + local composer draft state).

The host loads and persists reviews; the mirror emits `:review_submit` /
`:review_resolve`. Entry from the artifact view is `:review_start`; this
tag is the list/thread view. Rows are read straight from the `reviews` prop
on every render (the Lit `normalizeReviews` never-crash guarantee, applied
per render), so host snapshot updates flow without a re-mount.

Backend: None. Host owns data flow.

## Usage

```holo
<Review.Panel cid="review-panel-1" reviews={@reviews} artifact_id={@artifact_id} target="page" />
```

`cid` is required (the composer holds local draft state).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `reviews` | `:list` | `[]` | `{id, author, body, at?, status?}` rows; non-map rows drop. |
| `artifact_id` | `:string` | `""` | Carried on `:review_submit` params. |
| `show_composer` | `:boolean` | `true` | Composer renders → can emit `:review_submit`. |
| `target` | `:string` | `"parent"` | Host-notification target. |
| `class` | `:string` | `""` | Extra classes on the `.tk` root. |

## Event contract

| Lit event | Mirror action | Params |
|---|---|---|
| `review-submit` | `:review_submit` | `%{artifact_id, body}` — trimmed, empty refused, draft cleared (Lit `#submitFrom`) |
| `review-resolve` | `:review_resolve` | `%{id}` — per-row button, `open` rows only |

## Theming

| Token | Default |
|---|---|
| `--tobor-kit-review-max-height` | `24rem` (review list) |

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `review.panel` | panel root |
| `review.item` | review row |
| `review.composer` | textarea |
| `review.submit` | submit button |

## Divergences from the Lit component

1. **Stamps format by ISO-8601 shape, not `Date.parse`.** Regex-free port:
   `2026-09-15T10:30:00Z` → `2026-09-15 10:30 UTC`; anything else passes
   through unchanged (the Lit fallback path).
2. **No Enter-to-send on the composer.** The Lit `keydown` handler is
   dropped; submit via the button / form submit (same scope cut as
   chat-thread, minus the key binding).
3. **`target` semantics** — see the chat-thread README divergence 2
   (`"parent"` is not a runtime keyword; no-op catch-all mirrors an
   unlistened Lit CustomEvent). Flagged for `docs/PORTING.md` revision.
