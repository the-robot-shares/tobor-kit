# tobor-review-panel — configuration

Tags in this family: **`tobor-review-panel`**.

Shadow-DOM review thread. The host injects `reviews` as a JS property and persists `review-submit` / `review-resolve`. The element carries no secrets and does not call a server.

`<tobor-artifact-view>` emits `review-start` as the entry point; this panel is the list/thread view the host mounts after that. `review-start` is **not** an event of this tag.

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `reviews` | `Review[]` | no | `[]` | no | **Property-only** (`attribute: false`). Never serialized as an HTML attribute. Host replaces the array after persist. |
| `artifact-id` | `string` | no | `""` | yes | Artifact this thread belongs to. Copied onto `review-submit.detail.artifactId`. |
| `show-composer` | `boolean` | no | `true` | no | HTML attribute `show-composer`. Missing keeps `true`. Literal `show-composer="false"` hides the composer. |

`Review`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes | Stable id. Emitted on `review-resolve`. |
| `author` | `string` | yes | Display name. Rendered as text (Lit-escaped). |
| `body` | `string` | yes | Review text. `pre-wrap`; markup stays characters. |
| `at` | `string` | no | ISO datetime. Rendered as `YYYY-MM-DD HH:MM UTC`. Invalid strings render as given. Omitted when empty. |
| `status` | `'open' \| 'resolved'` | no | Missing / unknown → `open`. Resolve button only on `open`. |

Empty `reviews` renders **No reviews yet**. Composer still shows when `show-composer` is true.

The island does **not** append or mark resolved locally. Host sets a new `reviews` array after it persists.

## Events

Bubbling, composed `CustomEvent`s via kit `emit()`.

| Event | Detail | When |
|---|---|---|
| `review-submit` | `{artifactId: string, body: string}` | Composer submit or Enter (Shift+Enter inserts a newline). `body` is trimmed; empty values are not emitted. Host owns persistence. |
| `review-resolve` | `{id: string}` | **Resolve** clicked on an open row. Empty `id` is not emitted. Host owns persistence. |

Related (other tag): `review-start` from `<tobor-artifact-view>` — host opens this panel.

## Methods

None beyond `HTMLElement` / Lit lifecycle. Submit is the composer button (only when `show-composer`). Resolve is the row button (only when `status` is `open`).

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Tokens from `mode-toggle/theme` (`toborKitTokens`, `toborKitControls`).

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-review-max-height` | `24rem` | Max height of the scrollable list |
| `--tobor-kit-fg` | `#e8e9f0` | Body / author |
| `--tobor-kit-muted` | `#9aa0b4` | Meta, empty copy, resolved rows |
| `--tobor-kit-surface` | `#1b1d27` | Item / textarea background |
| `--tobor-kit-border` | `#2c2f3d` | Item / control border |
| `--tobor-kit-accent` | `#6ee7c7` | Button hover / focus |
| `--tobor-kit-accent-fg` | `#08130f` | Pressed control foreground |
| `--tobor-kit-radius` | `12px` | Item / control radius |
| `--tobor-kit-gap` | `12px` | Panel / list gap |
| `--tobor-kit-font-family` | system UI stack | Font |

| `::part()` | Node |
|---|---|
| `panel` | Outer wrapper |
| `list` | Review `<ul>` (when nonempty) |
| `item` | One review `<li>` |
| `meta` | Author / stamp / status row |
| `author` | Author name |
| `stamp` | Optional `<time>` |
| `status` | `open` / `resolved` |
| `body` | Review text |
| `resolve` | Resolve `<button>` (open rows) |
| `empty` | Empty-state copy |
| `composer` | Composer `<textarea>` |
| `submit` | Submit `<button>` |

No Light-DOM class hooks.

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix `review`. No `data-testid` on this tag. Hooks live in Shadow DOM.

| Hook | Selector | When |
|---|---|---|
| `review.panel` | `[data-cy="review.panel"]` | Always |
| `review.item` | `[data-cy="review.item"]` | One per `reviews[]` row |
| `review.composer` | `[data-cy="review.composer"]` | `show-composer` |
| `review.submit` | `[data-cy="review.submit"]` | `show-composer` |

Resolve is `::part(resolve)` (no extra `data-cy`).

## Theming

**Shadow DOM.** Restyle through CSS variables on the host (or ancestors) and `::part()`. Do not pierce this shadow root. Review HTML is escaped text with `pre-wrap` on the body.
