# tobor-robot-avatar

Animated robot avatar that renders one of 7 canonical states via glyph (with sprite/lottie fallbacks).

Full options: [docs/configuration.md](./docs/configuration.md). Backend:
[docs/backend-requirements.md](./docs/backend-requirements.md) (none).
Copy-paste hosts: [examples/](./examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/robot-avatar/robot-avatar.js"></script>

<tobor-robot-avatar state="idle" label="Guide"></tobor-robot-avatar>
```

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `state` | String | no | `idle` | One of 7 canonical states; unknown clamps to `idle` |
| `renderer` | String | no | `glyph` | `glyph` implemented; `sprite`/`lottie` fall back with `data-renderer-fallback` |
| `asset` | String | no | — | Sprite/lottie JSON URL |
| `states` | Object | no | — | Per-state `{segment?, loop?, speed?}` hints (property-only) |
| `avatar` | Object | no | — | Sprite-sheet group (property-only) |
| `reduced-motion` | String | no | `respect` | `respect \| force_static \| ignore` |
| `label` | String | no | `Guide` | `aria-label` prefix |

Reflects `data-state` / `data-motion` / `data-renderer`.

## Theming

Consumes the shared `--tobor-kit-*` tokens (see `web/README.md`).

- `--tobor-kit-robot-size` — `96px`
- `--tobor-kit-robot-shell`
- `--tobor-kit-robot-edge`
- `--tobor-kit-robot-visor` — `#0d0f16`
- `--tobor-kit-robot-accent`
