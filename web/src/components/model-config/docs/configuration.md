# noizu-model-config configuration

Tags in this family: `noizu-model-config`.

Model picker. Properties down, events up. The host owns persistence and
nearest-ancestor-wins inherit. This island carries no secrets, does not walk
the ancestor tree, and never logs API keys.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `catalog` | `{provider, model, label?, spec?}[]` (`json`) | no | `[]` | n/a | Property-only. Wins over `catalog-url` when nonempty. Never an HTML attribute. |
| `catalog-url` (`catalogUrl`) | string (`url`) | no | `""` | no | GET JSON. Accepts an array, or `{catalog\|models\|entries}`. Optional `{custom\|customEndpoint\|custom_endpoint}` may include a masked `apiKey` (`••••1234`). `credentials: 'same-origin'`. |
| `value` | string | no | `""` | yes | `provider:model` spec (or catalog `spec`). Empty (or `inherit`) selects Inherit when `inherit` is on. Custom specs are `custom:<model>`. |
| `inherit` | boolean | no | `false` | no | Show an Inherit option. Host maps empty `value` to nearest ancestor. |
| `allow-custom` (`allowCustom`) | boolean | no | `false` | no | Custom… option + OpenAI-compatible base URL / model / key form. |
| `allow-budget` (`allowBudget`) | boolean | no | `false` | no | Budget number input. |
| `budget` | number \| null | no | `null` | no | Current amount. Unit is host-owned (TRK example: `monthly_budget_cents`). |
| `customEndpoint` | `{baseUrl, model, apiKey?}` (`json`) | no | `null` | n/a | Property-only. `apiKey` may be a masked echo. Never an HTML attribute. Never log. |

`spec` on a catalog entry is the exact string stored in `value`; default is
`` `${provider}:${model}` ``. `label` is display-only (falls back to the spec).

## Events

| Name | Detail | When |
|---|---|---|
| `model-change` | `{value: string}` | The user changes the picker (catalog spec, Inherit → `""`, or Custom → `custom:<model>`). Bubbles, composed. Not fired when the host assigns `value`. |
| `custom-endpoint-save` | `{baseUrl: string, model: string, apiKey: string}` | Save endpoint. Empty `apiKey` means **keep the stored key**. Masked display (`••••1234`) also emits `apiKey: ''`. After a plaintext save the island clears the key field. Never log `apiKey`. |
| `budget-change` | `{amount: number}` | Budget `<input type="number">` `change`. Empty input emits `0`. |

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

Shared token sheet lives in `web/src/components/mode-toggle/theme.ts`.

| `::part()` | Node |
|---|---|
| `picker` | model `<select>` |
| `custom` | custom-endpoint `<fieldset>` |
| `budget` | budget `<input>` |
| `save` | Save endpoint button |

## `data-cy` / `data-testid`

Must match `registry.yaml`:

| Hook | Node |
|---|---|
| `model.picker` | `<select>` |
| `model.custom` | custom endpoint fieldset |
| `model.budget` | budget number input |
| `model.save` | save endpoint button |

No `data-testid` on this tag.

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Light-DOM class hooks are
not part of this island.
