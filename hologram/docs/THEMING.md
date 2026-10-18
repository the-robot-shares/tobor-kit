# Theming — token translation table + host guide

Source of truth for the token *definitions*:
`web/src/components/mode-toggle/theme.ts` (`toborKitTokens` +
`toborKitControls`). This file documents the light-DOM translation and how
hosts theme the mirrors. The translated stylesheet is
`assets/css/tobor-kit.css` (build artifact: `priv/static/tobor-kit.css`).

## 1. Translation rules

| Lit (Shadow DOM) | Hologram mirror (light DOM) |
|---|---|
| `:host { --tobor-kit-X: … }` public vars | keep **exact names**, declared on `.tk` |
| `:host { --_bg: var(--tobor-kit-bg, #12131a) }` private aliases | `--tk-bg: var(--tobor-kit-bg, #12131a)` on `.tk` — re-prefixed, **still reading the public var with fallback** (never declare the public var, or ancestor theming breaks) |
| `:host { color; font-family; box-sizing … }` | `.tk { … }` |
| bare element selectors (`button { … }`) | `.tk button { … }` — scoped, never leak |
| `:host([attr=x]) sel` | `.tk[attrs] sel` / `.tk sel[attrs]` (attributes now live on real elements) |
| `::slotted(x)` | `.tk .tk-<thing> x` classes |
| `@keyframes tk-*` | copied verbatim (prefix collision-safe) |
| `part="x"` | dropped — `data-cy` (registry.yaml) is the contract |
| `.muted` / `.notice` utility classes | `.tk .muted` / `.tk .notice` |

Scoping contract: every rule lives under `.tk`; no bare selectors, ever
(`docs/PORTING.md` §5).

## 2. Token table (wave 0)

| Public var | Private alias | Default |
|---|---|---|
| `--tobor-kit-font` | — | `var(--tobor-kit-font-family, system-ui, -apple-system, "Segoe UI", sans-serif)` |
| `--tobor-kit-bg` | `--tk-bg` | `#12131a` |
| `--tobor-kit-surface` | `--tk-surface` | `#1b1d27` |
| `--tobor-kit-fg` | `--tk-fg` | `#e8e9f0` |
| `--tobor-kit-muted` | `--tk-muted` | `#9aa0b4` |
| `--tobor-kit-accent` | `--tk-accent` | `#6ee7c7` |
| `--tobor-kit-accent-fg` | `--tk-accent-fg` | `#08130f` |
| `--tobor-kit-border` | `--tk-border` | `#2c2f3d` |
| `--tobor-kit-danger` | `--tk-danger` | `#ff6b6b` |
| `--tobor-kit-warn` | `--tk-warn` | `#f5c451` |
| `--tobor-kit-radius` | `--tk-radius` | `12px` |
| `--tobor-kit-gap` | `--tk-gap` | `12px` |
| `--tobor-kit-shadow` | `--tk-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` |
| `--tobor-kit-duration` | `--tk-duration` | `320ms` |

Controls (buttons, `.muted`, `.notice`) translate 1:1 under `.tk`; see the
`/* == controls == */` section of the stylesheet.

## 3. Host theming guide

Two supported mechanisms (same as the Lit kit's theming surface):

### 3.1 Ancestor custom properties

Because the private aliases read `var(--tobor-kit-*, default)` and the
public vars are never re-declared on `.tk`, hosts may set vars on any
ancestor:

```css
.my-app {
  --tobor-kit-accent: #f59e0b;
  --tobor-kit-radius: 6px;
}
```

### 3.2 Guide projection (`ui.theme` map) — inline style attr

The guide-projection's free-form `ui.theme` string-keyed map projects to an
inline style string with `ToborKit.Hologram.Support.Theme.apply_theme_vars/2`
(replaces the Lit runtime `applyThemeVars(host, theme)`):

```elixir
# in the host's stateful component init/3
def init(_params, component, _server) do
  style = Theme.apply_theme_vars(%{"accent" => "#6ee7c7", "border_radius" => "8px"})
  put_state(component, theme_style: style)
end
```

```holo
<div class="tk tk-guide-panel" style={@theme_style}>…</div>
```

Rules: `accent_color` → `--tobor-kit-accent-color` (underscore → dash);
keys already starting with `--` pass through; values are trimmed; values
containing `;` or newlines are dropped (style-attr injection guard).

Inline style (root element) beats both `.tk` class declarations and
ancestors, matching the Lit behavior where the projection set properties
directly on the host element.

## 4. Installing the stylesheet

```bash
mix tobor_kit_hologram.install   # → priv/static/css/tobor-kit.css + <link> snippet
```

The gallery fixture page links `/css/tobor-kit.css`; serve that path from
the installed file.
