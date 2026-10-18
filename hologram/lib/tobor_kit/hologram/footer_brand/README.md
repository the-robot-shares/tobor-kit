# footer-brand mirror (presentational islands)

Mirror of `web/src/components/footer-brand/noizu-footer-brand.ts` —
contract class A (stateless render-only). Module:
`ToborKit.Hologram.FooterBrand.Brand`.

## Usage

```holo
<FooterBrand />
<FooterBrand theme="light" palette="accent" prefix="Built by" suffix="Labs"
             href="https://noizu.com" />
<FooterBrand palette="mono" align="start" />
```

No `cid` required — the mirror is stateless and binds nothing (the brand
anchor navigates natively; hosts need no actions).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `href` | string | `https://derobot.is` | link target for the brand name |
| `target` | string | `""` | anchor target; attribute dropped when empty, `_blank` adds `rel="noopener noreferrer"` |
| `brand` | string | `The Robot Lives` | text inside the link |
| `prefix` | string | `A` | leading piece; empty string suppresses it and its spacing |
| `suffix` | string | `Joint` | trailing piece; empty string suppresses it and its spacing |
| `theme` | string | `dark` | clamped to `dark` \| `light` \| `auto` |
| `palette` | string | `default` | clamped to `default` \| `mono` \| `accent` |
| `align` | string | `center` | clamped to `start` \| `center` \| `end` |
| `class` | string | `""` | extra root class |

Enum clamping happens in template-called helpers (`theme/1`, `palette/1`,
`align/1`) — invalid input renders the documented default, never a broken
data attribute.

## Event/action contract

None. The Lit tag emits no events (registry `events: []`), so `Support.Events`
gains no entries and the mirror binds no `$click`/`$change`. The anchor is a
native `<a href>` — the host owns the destination.

## Theming

`.tk-footer-brand__*` classes under `.tk`; presets scope off the data
attributes the template renders (`data-theme`, `data-palette`,
`data-align`). Public override vars `--noizu-footer-brand-*` are read with
the same fallback chain as the Lit source (never re-declared, so hosts may
set them on any ancestor).

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `footer-brand.root` | the line `p` |
| `footer-brand.link` | the brand anchor |

## Divergences from Lit

- The Lit `:host([theme=...])` / `:host([palette=...])` selectors become
  `.tk-footer-brand[data-theme=...]` / `[data-palette=...]` (attributes live
  on real elements per `docs/THEMING.md` §1). `prefers-color-scheme` for
  `theme="auto"` is a plain CSS media query in the shared stylesheet.
- Spacing around prefix/suffix is decided in `line_prefix/1` / `line_suffix/1`
  instead of template whitespace, so suppression is exact.

Backend: None. Host-only presentational island.
