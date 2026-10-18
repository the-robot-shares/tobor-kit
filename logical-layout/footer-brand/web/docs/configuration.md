# noizu-footer-brand configuration

Tags in this family: `noizu-footer-brand`.

One-line "made by" attribution for site footers. Presentational island:
no events, no slots, no backend. Hosts own the link destination; the element
never redirects, stores, or calls anything.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `href` | String (url) | no | `https://derobot.is` | yes | Anchor `href` for the brand link. |
| `target` | String | no | `""` | yes | Anchor target. The attribute is omitted while empty. `target="_blank"` renders `rel="noopener noreferrer"`. |
| `brand` | String | no | `The Robot Lives` | yes | Text inside the link (the brand name). |
| `prefix` | String | no | `A` | yes | Leading piece. Empty string suppresses the piece **and** its spacing. |
| `suffix` | String | no | `Joint` | yes | Trailing piece. Empty string suppresses the piece **and** its spacing. |
| `theme` | String | no | `dark` | yes | `dark` \| `light` \| `auto`. `auto` follows `prefers-color-scheme` via `@media` inside the shadow styles; invalid values fall back to `dark` (CSS attribute selectors simply do not match). |
| `palette` | String | no | `default` | yes | `default` \| `mono` \| `accent`. Token values only — no runtime logic. Invalid values fall back to `default`. |
| `align` | String | no | `center` | yes | `start` \| `center` \| `end`; maps to `text-align`. Invalid values fall back to `center`. |

Default render: `A The Robot Lives Joint`.

## Events

None. The link navigates through the browser's normal anchor handling; the
host owns the destination and any analytics.

## Methods

None.

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Cascade order (highest wins):

1. Explicit `--noizu-footer-brand-*` value set by the host (element or any
   ancestor).
2. `palette` / `theme` presets (token values only).
3. Shared `--tobor-kit-*` tokens, then built-in fallbacks.

Public vars:

| Token | Default |
|---|---|
| `--noizu-footer-brand-font` | `var(--tobor-kit-font)` |
| `--noizu-footer-brand-brand-font` | `"Space Grotesk", var(--tobor-kit-font)` |
| `--noizu-footer-brand-size` | `0.875rem` |
| `--noizu-footer-brand-fg` | palette body color |
| `--noizu-footer-brand-brand-color` | palette brand color |
| `--noizu-footer-brand-letter-spacing` | `normal` |
| `--noizu-footer-brand-padding` | `0` |

The public vars are **never declared** by the element itself (the
`--_alias: var(--public, fallback)` pattern from `theme.ts`) — declaring them
would break ancestor-level theming.

Preset matrix (`theme` picks the scheme the palette reads):

| palette | body text | brand link | hover |
|---|---|---|---|
| `default` | muted (`--tobor-kit-muted`) | accent (`--tobor-kit-accent`) | — |
| `mono` | fg (`--tobor-kit-fg`) | fg — distinguished by display font + weight only | — |
| `accent` | fg (`--tobor-kit-fg`) | accent (`--tobor-kit-accent`) | accent underline |

`theme="light"` switches the scheme to light values (`#14161f` / `#5a5f73` /
`#0e7a5f`); `theme="auto"` uses the dark scheme by default and the light
scheme inside `@media (prefers-color-scheme: light)`. A link shows a
`:focus-visible` outline in the kit accent. Hover/focus transitions only run
under `prefers-reduced-motion: no-preference`.

| `::part()` | Node |
|---|---|
| `root` | the `p.root` line |
| `link` | the brand `a.link` |
| `brand` | the brand `a.link` (same node; style hook for the brand text) |

## `data-cy` / `data-testid`

`registry.yaml` freezes `cy_prefix: footer-brand` with:

- `footer-brand-root` — the line
- `footer-brand-link` — the brand anchor

Live-host tests use `customElements.whenDefined('noizu-footer-brand')` plus
these hooks (shadow selectors via `lit-test/cypress.ts`).
