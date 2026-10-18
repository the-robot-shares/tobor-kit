# Configuration — styleguide family

Tags in this family: **`noizu-sg-btn`**, **`noizu-sg-card`**, **`noizu-sg-card-grid`**, **`noizu-sg-status`**, **`noizu-sg-input`**, **`noizu-sg-spec-table`**, **`noizu-sg-steps`**.

Shadow-DOM portfolio atoms. The host supplies copy via slots or properties and owns navigation. The elements carry no secrets and do not call a server. Spec table / status / steps / input values render as **text** (Lit interpolation; never `unsafeHTML`).

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

Primary playground tag (`configurator`): `noizu-sg-btn`. All seven: `configurators` (`btn`, `card`, `cardGrid`, `status`, `input`, `specTable`, `steps`).

## Properties / attributes

### `noizu-sg-btn`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | no | `primary` | yes | Unknown values render as `primary`. |
| `size` | `'sm' \| 'md' \| 'lg'` | no | `md` | yes | Unknown values render as `md`. |
| `disabled` | boolean | no | `false` | yes | Lit Boolean: attribute presence is true (`disabled="false"` is still true). |
| `type` | `'button' \| 'submit'` | no | `button` | yes | Native inner `<button type>`. Unknown values render as `button`. |

### `noizu-sg-card`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `href` | string | no | `""` | yes | Trimmed. Nonempty → the surface is an `<a href>`. Empty → `<article>`. |

### `noizu-sg-card-grid`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `columns` | number | no | `3` | yes | Layout uses `Math.floor`; non-positive or NaN falls back to 3. |

### `noizu-sg-status`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `status` | `'ok' \| 'warn' \| 'error' \| 'idle'` | no | `idle` | yes | Unknown values render as `idle`. Maps StyleGuideStatusIndicator. |
| `label` | string | no | `""` | yes | Primary copy. Text only. |
| `description` | string | no | `""` | yes | Secondary copy. Omitted from the tree when empty. Text only. |

### `noizu-sg-input`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `name` | string | no | `""` | yes | Forwarded to the inner control. Omitted when empty. |
| `type` | string | no | `text` | yes | `textarea` → inner `<textarea>`. Else whitelist `text` \| `password` \| `email` \| `number` \| `url` \| `tel` \| `search`. Unknown → `text`. Maps StyleGuideInputField. |
| `disabled` | boolean | no | `false` | yes | Lit Boolean. Native disabled; no `sg-input`. |
| `error` | boolean | no | `false` | yes | Lit Boolean. Invalid border + `aria-invalid`. |
| `value` | string | no | `""` | yes | Bound to the inner control. Typing updates the property. |

### `noizu-sg-spec-table`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `rows` | `{key: string, value: string}[]` | no | `[]` | no | **Property-only.** Non-array falls back to `[]`. Each cell is `String(...)` text — never HTML. Maps StyleGuideSpecTable. |

### `noizu-sg-steps`

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `steps` | `string[]` | no | `[]` | no | **Property-only.** Non-array falls back to `[]`. Labels are text. Maps StyleGuideStepProgress. |
| `current` | number | no | `0` | yes | **0-based** index of the current step (`i < current` = done). `Math.floor`; non-finite falls back to 0. |

## Events

Bubbling, composed `CustomEvent`s.

| Tag | Event | Detail | When |
|---|---|---|---|
| `noizu-sg-btn` | `sg-click` | `{}` | Inner button clicked. Not fired when `disabled`. Via kit `emit()`. |
| `noizu-sg-card` | `sg-card-select` | `{href: string}` | Card surface activated. **Cancelable.** `href` is the trimmed attribute (empty string when unset). Nested controls (`noizu-sg-btn`, native `button`/`a`/`input`/…) do not select the card; the card link does not navigate in that case. |
| `noizu-sg-card-grid` | — | — | No events. |
| `noizu-sg-status` | — | — | No events. |
| `noizu-sg-input` | `sg-input` | `{value: string}` | Inner `input` event. Not fired when `disabled`. Via kit `emit()`. |
| `noizu-sg-spec-table` | — | — | No events. |
| `noizu-sg-steps` | — | — | No events. |

Host owns navigation: listen for `sg-card-select` and call `preventDefault()` on that event to stop the inner `<a>` from following `href`. Host owns form submit / persistence for `sg-input`.

## Methods

None beyond `HTMLElement` / Lit lifecycle.

## Slots

| Tag | Slot | Required | Notes |
|---|---|---|---|
| `noizu-sg-btn` | default | no | Button label. |
| `noizu-sg-card` | `header` | no | Title row. |
| `noizu-sg-card` | default | no | Body. |
| `noizu-sg-card` | `footer` | no | Footer / meta. |
| `noizu-sg-card-grid` | default | no | Card children (`<noizu-sg-card>` or host markup). |
| `noizu-sg-status` | — | — | No slots. Use `label` / `description`. |
| `noizu-sg-input` | — | — | No slots. |
| `noizu-sg-spec-table` | — | — | No slots. Use `rows`. |
| `noizu-sg-steps` | — | — | No slots. Use `steps`. |

## CSS custom properties / `::part()`

Shadow DOM. Tokens from `mode-toggle/theme` (`toborKitTokens`; `toborKitControls` on the button and input).

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-fg` | `#e8e9f0` | Text; secondary button |
| `--tobor-kit-muted` | `#9aa0b4` | Card footer; idle status; spec keys; todo steps |
| `--tobor-kit-accent` | `#6ee7c7` | Primary fill; focus; card-link hover border; ok status; current/done step bar |
| `--tobor-kit-accent-fg` | `#08130f` | Primary label |
| `--tobor-kit-surface` | `#1b1d27` | Card, secondary fill, input, spec table |
| `--tobor-kit-border` | `#2c2f3d` | Borders |
| `--tobor-kit-danger` | `#ff6b6b` | Danger button; error status; invalid input |
| `--tobor-kit-warn` | `#f5c451` | Warn status |
| `--tobor-kit-radius` | `12px` | Corners |
| `--tobor-kit-gap` | `12px` | Grid gap; step gap |
| `--tobor-kit-shadow` | `0 12px 32px rgb(0 0 0 / 35%)` | Card elevation |
| `--tobor-kit-font-family` | system UI stack | Font |

| `::part()` | Tag | On |
|---|---|---|
| `btn` | `noizu-sg-btn` | Inner `<button>` |
| `card` | `noizu-sg-card` | Surface (`<a>` or `<article>`) |
| `header` | `noizu-sg-card` | Header slot wrapper |
| `body` | `noizu-sg-card` | Default slot wrapper |
| `footer` | `noizu-sg-card` | Footer slot wrapper |
| `grid` | `noizu-sg-card-grid` | Grid container |
| `status` | `noizu-sg-status` | Status row |
| `dot` | `noizu-sg-status` | Tone marker |
| `label` | `noizu-sg-status` | Primary copy |
| `description` | `noizu-sg-status` | Secondary copy |
| `field` | `noizu-sg-input` | Inner `<input>` or `<textarea>` |
| `table` | `noizu-sg-spec-table` | `<table>` |
| `steps` | `noizu-sg-steps` | `<ol>` |
| `step` | `noizu-sg-steps` | Each `<li>` |
| `bar` | `noizu-sg-steps` | Track segment |
| `index` | `noizu-sg-steps` | 1-based index label |
| `label` | `noizu-sg-steps` | Step copy |

No Light-DOM class hooks. Grid column count is `--sg-columns` on `::part(grid)` (internal; prefer the `columns` attribute).

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix `sg`. No `data-testid` on these tags. Hooks live in Shadow DOM.

| Hook | Node |
|---|---|
| `sg.btn` | Inner `<button>` |
| `sg.card` | Card surface (`<a>` or `<article>`) |
| `sg.grid` | Grid container (`data-columns` is the resolved count) |
| `sg.status` | Status row (`data-status` is the resolved tone) |
| `sg.input` | Inner `<input>` or `<textarea>` (`data-error` is `"true"` \| `"false"`) |
| `sg.spec` | Spec `<table>` |
| `sg.steps` | Steps `<ol>` (`data-current` is the resolved 0-based index) |

## Theming

Shadow DOM — restyle through the `--tobor-kit-*` tokens and `::part(...)`. Do not pierce the shadow tree. Light DOM is not used.

## Accessible-field additions

See the family README's **Accessible fields and native framework events** section for the complete `noizu-sg-select` API and the backward-compatible `noizu-sg-input` additions. Both expose internal native labels, `help-text`, `error-message`, `required`, and a delegated `focus()` method. Neither participates in ancestor FormData. `sg-input` remains unchanged; `sg-change` is the select custom event. Both additionally expose one composed native change event with the updated host value for framework bindings.
