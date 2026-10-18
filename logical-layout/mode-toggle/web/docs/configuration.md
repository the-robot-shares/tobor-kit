# tobor-mode-toggle configuration

Tags in this family: `tobor-mode-toggle`.

Voice ⇄ text ⇄ transcript switcher. Properties down, one event up. The host
owns persistence; this island carries no secrets and calls no API.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `modes` | `GuideMode[]` (`json`) | no | `["text"]` | n/a | Property-only. Display order from the guide projection's `modes`. Never an HTML attribute. Empty array renders nothing. |
| `mode` | `GuideMode` (`voice` \| `text` \| `transcript`) | no | `text` | no | Active mode. HTML attribute `mode`. |
| `disabled` | boolean | no | `false` | no | Disables every radio. HTML attribute `disabled`. |

`GuideMode` is `"voice" | "text" | "transcript"`. Labels: Voice, Text, Transcript.

## Events

| Name | Detail | When |
|---|---|---|
| `tobor-mode-change` | `{mode, previous}` | The user selects a mode other than the current one. Bubbles, composed. Not fired on re-select or while `disabled`. |

`mode` and `previous` are `GuideMode` values.

## Methods

None.

## Slots

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

Shared token sheet lives in `theme.ts` (used by other kit elements; leave it here).

| `::part()` | Node |
|---|---|
| `group` | `[role="radiogroup"]` |
| `mode` | each `button[role="radio"]` |

Buttons also expose `data-mode="<GuideMode>"` and `aria-checked`.

## `data-cy` / `data-testid`

`registry.yaml` freezes `cy_prefix: mode` and lists **no** `cy` hooks and **no**
`data-testid` on this tag. Do not invent `data-cy` names here.

Live-host tests use `customElements.whenDefined('tobor-mode-toggle')` plus
shadow selectors (`button[data-mode]`, `[role="radiogroup"]`).

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. The guide projection's
`ui.theme` map is applied by the panel host (`applyThemeVars`), not by this
element. Light-DOM class hooks are not part of this island.
