# noizu-footer-brand

One-line "made by" attribution for site footers. Renders
`A The Robot Lives Joint` — the brand name is a link in a display face,
colored by palette. Presentational only: no events, no slots, no backend.

Full options: [docs/configuration.md](./docs/configuration.md). Backend:
[docs/backend-requirements.md](./docs/backend-requirements.md) (none).
Copy-paste hosts: [examples/](./examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/footer-brand/noizu-footer-brand.js"></script>

<noizu-footer-brand></noizu-footer-brand>
```

Customized:

```html
<noizu-footer-brand
  prefix="Built by"
  suffix=""
  brand="Noizu Labs"
  href="https://noizu.com"
  target="_blank"
  palette="mono"
  align="end"
></noizu-footer-brand>
```

## Parent-organization attribution

The line is built from `prefix` + `brand` + `suffix`, so naming a parent project
needs no variant attribute:

```html
<noizu-footer-brand prefix="a" brand="noizu.com" suffix="project" href="https://noizu.com">
  a <a href="https://noizu.com">noizu.com</a> project
</noizu-footer-brand>
```

The children are optional and are the recommended host pattern for a
server-rendered page. The shadow root carries no slot, so that copy is visible
to a crawler and to anyone whose script never runs, and is hidden as soon as the
element upgrades.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Description |
|---|---|---|---|---|---|
| `href` | String (url) | no | `https://derobot.is` | yes | Link target for the brand name |
| `target` | String | no | `""` | yes | Anchor target; attribute omitted when empty. `_blank` renders `rel="noopener noreferrer"` |
| `brand` | String | no | `The Robot Lives` | yes | Brand name inside the link |
| `prefix` | String | no | `A` | yes | Leading text; empty string suppresses it and its spacing |
| `suffix` | String | no | `Joint` | yes | Trailing text; empty string suppresses it and its spacing |
| `theme` | String | no | `dark` | yes | `dark` \| `light` \| `auto` (auto follows `prefers-color-scheme`) |
| `palette` | String | no | `default` | yes | `default` \| `mono` \| `accent` |
| `align` | String | no | `center` | yes | `start` \| `center` \| `end` |

## Events / slots / methods

None. Presentational island.

## Palette × theme matrix

Presets set token values only; `theme` picks the scheme those tokens read
from. Explicit `--noizu-footer-brand-*` overrides win over every cell below.

| palette | body text | brand link | hover |
|---|---|---|---|
| `default` | muted (`--tobor-kit-muted`) | accent (`--tobor-kit-accent`) | — |
| `mono` | fg (`--tobor-kit-fg`) | fg — distinguished by display font + weight only | — |
| `accent` | fg (`--tobor-kit-fg`) | accent (`--tobor-kit-accent`) | accent underline |

`theme="light"` swaps the scheme to light values; `theme="auto"` follows
`prefers-color-scheme` (dark by default). Both presets still respect explicit
`--noizu-footer-brand-fg` / `--noizu-footer-brand-brand-color` overrides.

## `::part()` / hooks

`part="root"` (the line), `part="link"` and `part="brand"` (the anchor).
`data-cy` hooks (registry name freeze): `footer-brand-root`, `footer-brand-link`.

## Theming

Shadow DOM. Public vars (explicit value beats presets, works from any
ancestor):

| Token | Default |
|---|---|
| `--noizu-footer-brand-font` | `var(--tobor-kit-font)` |
| `--noizu-footer-brand-brand-font` | `"Space Grotesk", var(--tobor-kit-font)` |
| `--noizu-footer-brand-size` | `0.875rem` |
| `--noizu-footer-brand-fg` | palette body color |
| `--noizu-footer-brand-brand-color` | palette brand color |
| `--noizu-footer-brand-letter-spacing` | `normal` |
| `--noizu-footer-brand-padding` | `0` |

Presets consume the shared `--tobor-kit-*` tokens (see `../mode-toggle/theme.ts`
/ `web/README.md`).
