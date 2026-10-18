# NPL view family configuration

Tag: `tobor-npl-view`.

Shadow-DOM island. Properties down, events up. `source` is NPL / prompt-lingua
text. The island **never** renders raw source with `unsafeHTML` — tokens become
`<span class="npl-*">` around Lit-escaped text.

Foldable sections: a new `<details>` starts when a line (after leading
whitespace) begins with `#` or `⌜NPL`. Preamble before the first heading is a
plain block. Sections default open. `⌜extend:NPL…⌝` is not a fold start.

Copy emits `npl-copy` `{text}` with the current `source` and writes
`navigator.clipboard` when that API exists. Missing clipboard does not suppress
the event.

See [backend-requirements.md](./backend-requirements.md) (none).

## `tobor-npl-view`

### Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `source` | `string` (`text`) | no | `""` | no | NPL / prompt-lingua. Empty / whitespace shows “No source.” and disables Copy. Also the `source` HTML attribute. |

### Events

| Name | Detail | When |
|---|---|---|
| `npl-copy` | `{text: string}` | Copy click. `text` is the current `source`. Bubbles, composed. Clipboard write is best-effort. |

### Methods

None.

### Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Style through tokens on the host (or an ancestor); do not pierce.

| Token | Default |
|---|---|
| `--tobor-kit-font-family` | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--tobor-kit-bg` | `#12131a` |
| `--tobor-kit-surface` | `#1b1d27` |
| `--tobor-kit-fg` | `#e8e9f0` |
| `--tobor-kit-muted` | `#9aa0b4` |
| `--tobor-kit-accent` | `#6ee7c7` |
| `--tobor-kit-accent-fg` | `#08130f` |
| `--tobor-kit-border` | `#2c2f3d` |
| `--tobor-kit-danger` | `#ff6b6b` |
| `--tobor-kit-warn` | `#f5c451` |
| `--tobor-kit-radius` | `12px` |
| `--tobor-kit-gap` | `12px` |
| `--tobor-kit-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` |
| `--tobor-kit-duration` | `320ms` |
| `--tobor-kit-npl-max-height` | `32rem` (scrollable source pane) |

Shared token sheet lives in `web/src/components/mode-toggle/theme.ts`.

Highlight classes (shadow-internal, not styleguide): `npl-text`,
`npl-declaration`, `npl-placeholder`, `npl-infill`, `npl-highlight`,
`npl-attention`, `npl-logic`, `npl-literal`, `npl-tag`.

| `::part()` | Node |
|---|---|
| `root` | wrapping `<article>` |
| `copy` | Copy button |
| `source` | scrollable source pane |
| `section` | each foldable `<details>` |
| `fold` | `<summary>` fold control |
| `empty` | empty-state copy |

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix freeze: `npl`.

| Hook | Control |
|---|---|
| `npl.view` | Root article |
| `npl.copy` | Copy button |
| `npl.fold` | Each section `<summary>` |

No `data-testid` hooks.

## Theming

Shadow DOM (default Lit render root). Tokens on `:host` / ancestors. No Light
DOM, no styleguide classes, no piercing selectors.
