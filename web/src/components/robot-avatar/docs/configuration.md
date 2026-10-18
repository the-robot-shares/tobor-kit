# Configuration — tobor-robot-avatar

## Tags

| Tag | File |
|---|---|
| `tobor-robot-avatar` | `robot-avatar.ts` |

Pure state machine over the seven canonical guide states. The host sets `state`; the element never infers it from voice, network, or timers.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `state` | `"idle" \| "listening" \| "thinking" \| "speaking" \| "tool_running" \| "error" \| "offline"` | no | `idle` | yes (`state`) | Unknown values clamp to `idle` and set `data-unknown-state` |
| `renderer` | `"glyph" \| "sprite" \| "lottie"` | no | `glyph` | no | `glyph` is implemented. `sprite`/`lottie` without art fall back to the glyph |
| `asset` | `string` (URL) | no | — | no | Sprite sheet / Lottie JSON URL from `ui.robot.asset` |
| `reduced-motion` | `"respect" \| "force_static" \| "ignore"` | no | `respect` | no (attr `reduced-motion`) | Property name `reducedMotion` |
| `label` | `string` | no | `Guide` | no | `aria-label` prefix; resolved state is appended |
| `states` | `Record<string, {segment?, loop?, speed?}>` | no | — | **propertyOnly** | Per-state animation hints from `ui.robot.states`. `speed` scales CSS `--_tk-speed` |
| `avatar` | `AvatarGroup` | no | — | **propertyOnly** | Sprite-sheet group `{id, label?, default?, states?}`. Not an HTML attribute |

Getters (not methods): `resolvedState` (clamped `GuideState`), `motion` (`"animated" \| "static"` after the reduced-motion policy).

## Host-reflected data attributes

Written during render — this is how a host (and e2e) reads the resolved view:

| Attribute | Values | When |
|---|---|---|
| `data-state` | the seven canonical states | always; unknown input becomes `idle` |
| `data-motion` | `animated` \| `static` | after `reduced-motion` + `prefers-reduced-motion` |
| `data-renderer` | `glyph` \| `sprite` \| `lottie` | requested renderer |
| `data-renderer-fallback` | `glyph` | requested renderer is not `glyph` and no usable `avatar` `src` |
| `data-unknown-state` | the raw string | `state` was not one of the seven |

## Events

None. The island does not emit.

## Methods

None.

## Slots

None.

## CSS custom properties / `::part()`

| Token | Default | Role |
|---|---|---|
| `--tobor-kit-robot-size` | `96px` | Host width/height |
| `--tobor-kit-robot-shell` | `var(--tobor-kit-surface, #1b1d27)` | Head / torso / antenna fill |
| `--tobor-kit-robot-edge` | `var(--tobor-kit-border, #2c2f3d)` | Stroke |
| `--tobor-kit-robot-visor` | `#0d0f16` | Visor fill |
| `--tobor-kit-robot-accent` | `var(--tobor-kit-accent, #6ee7c7)` | Lit eyes / mouth / badge |

`error` uses `--tobor-kit-danger` for lit strokes. `offline` greyscales and drops opacity.

| `::part()` | Node |
|---|---|
| `svg` | Glyph `<svg>` |
| `image` | Sprite-sheet `<div>` when `avatar` supplies a `src` |
| `antenna` | Antenna tip |
| `head` | Head shell |
| `visor` | Visor |
| `torso` | Torso |
| `eyes` | Eye group (`data-eyes`) |
| `thinking-dots` | Thinking dots (`thinking` only) |
| `mouth` | Mouth group (`data-mouth`) |
| `badge` | Tool-running badge |

## `data-cy` / `data-testid`

`registry.yaml` `cy_prefix`: `robot`. No `data-cy` hooks are listed — do not invent them.

Grandfathered: `data-testid="state-label"` on the visually hidden resolved-state text.

## Theming

**Shadow DOM.** Style through the tokens above (and the shared `--tobor-kit-*` kit tokens consumed by `toborKitTokens`). Do not pierce the shadow tree. Set tokens on the host or an ancestor:

```css
tobor-robot-avatar {
  --tobor-kit-robot-size: 128px;
  --tobor-kit-robot-shell: #1b1d27;
  --tobor-kit-robot-edge: #2c2f3d;
  --tobor-kit-robot-visor: #0d0f16;
  --tobor-kit-robot-accent: #6ee7c7;
}
```
