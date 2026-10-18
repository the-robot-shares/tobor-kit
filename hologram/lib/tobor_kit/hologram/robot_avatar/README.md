# robot-avatar mirror (wave 1)

Mirror of `web/src/components/robot-avatar/robot-avatar.ts` — contract
class B (stateful, no host actions; init/3 runs server-side). Module:
`ToborKit.Hologram.RobotAvatar.Avatar`.

**Embed with a `cid`** — without it init/3 never runs.

## Usage

```holo
<RobotAvatar.Avatar cid="guide-avatar" state="thinking" label="Guide" />
<RobotAvatar.Avatar cid="guide-avatar-2" state="idle" reduced_motion="force_static" />
```

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `state` | string | `idle` | clamped to the seven guide states; invalid input echoes on `data-unknown-state` |
| `renderer` | string | `glyph` | sprite/lottie fall back to glyph w/o a sanitized source |
| `avatar` | map | `%{}` | `{states: {<state>: {src, columns, rows, column, row}}, default: {...}}` |
| `states` | map | `%{}` | per-state `{speed}` animation hints (`1/speed`) |
| `reduced_motion` | string | `respect` | `force_static` / `ignore` / `respect` |
| `label` | string | `Guide` | `aria-label = "<label>: <state>"` |
| `class` | string | `""` | extra root class |

Server-side (init/3): state clamp, motion resolution, sprite selection,
`asset.src` sanitization (port of the `/^(?:javascript|vbscript|data:(?!image\/))/i`
guard, plus quotes/parens/whitespace rejection for style-attr safety).

## Events

None (Lit has none; the mirror has no actions). State changes flow by the
host re-embedding with a new `state` prop.

## Theming / animation

`.tk-robot-avatar[data-*]` selectors + `.tk-robot-avatar` CSS classes
(`shell`, `visor`, `lit`, `stroke-lit`, `blink`, `pulse`, `ring`,
`think-dot`, `bar`, `gear`, `asset`); `@keyframes tk-*` copied verbatim.
Robot-specific tokens: `--tobor-kit-robot-size/shell/edge/visor/accent`.

Animations run only under `data-motion="animated"`.

## data-cy (registry.yaml)

`tobor-robot-avatar` has `cy_prefix: robot` but **no `cy:` entries** — no
`data-cy` hooks (never invented). Locate via `data-state` / `data-eyes` /
`data-mouth` attributes and the `sr-only` state label.

## Divergences from Lit

- **Reduced-motion `respect`**: the server cannot query
  `prefers-reduced-motion`; `respect` resolves to `animated` and the
  stylesheet's `@media (prefers-reduced-motion: reduce)` block downgrades
  it at display time (same observable behavior, CSS-side).
- **`asset` string prop**: declared-but-unused in the Lit render; the
  mirror only accepts the `avatar` map.
- **Sprite source sanitization is stricter**: sources containing quotes,
  parens, or whitespace are also rejected (style-attr safety).
- `data-testid="state-label"` (Lit) renders as the `sr-only` span with the
  state text; test ids are not part of the frozen contract.

Backend: None.
