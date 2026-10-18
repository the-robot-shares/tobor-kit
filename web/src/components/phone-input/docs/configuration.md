# Configuration — noizu-phone-input

Tags in this family: **`noizu-phone-input`**.

Shadow-DOM input island. Country selector (emoji flag + ISO-3166 alpha-2 + dial) plus a national number field. `value` is in-kit E.164: `+<dial><national-digits>`. No libphonenumber-js. Hosts own uniqueness / OTP. The element carries no secrets.

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Properties / attributes

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `country` | `string` (ISO-3166 alpha-2) | no | `US` | yes | Unknown / empty values fall back to `US`. |
| `mobile-only` | `boolean` | no | `false` | yes | HTML attribute `mobile-only`. Digit-only national field; `inputmode="tel"`; `autocomplete="tel-national"`. |
| `name` | `string` | no | `""` | yes | Copied onto the inner `<input type="tel">`. |
| `disabled` | `boolean` | no | `false` | yes | Disables the country `<select>` and the tel input. |
| `value` | `string` (E.164) | no | `""` | yes | `+<dial><national-digits>`. Setting a `+…` value hydrates `country` + national digits (longest matching dial; `+1` prefers the current NANP country, else US). |
| `described-by` (`describedBy`) | `string` | no | `""` | yes | Forwarded onto the inner `<input>` as `aria-describedby`. Use the id of a description element that lives in the **same tree scope** as this element's host tag (e.g. a sibling `<p id="…">` rendered by the parent, such as `<noizu-auth>`). Setting `aria-describedby` directly on the `<noizu-phone-input>` host tag does not work — it cannot reach across into this element's own shadow DOM. |

`mobile-only` false: `autocomplete="tel"`; formatting characters may appear in the national field but are stripped for E.164. A leading trunk `0` is stripped for non-`+1` countries (e.g. GB `07911…` → `+447911…`).

## Events

Bubbling, composed `CustomEvent`s via `emit()`.

| Event | Detail | When |
|---|---|---|
| `country-change` | `{country: string, dial: string}` | The user changes the country `<select>` (or pastes a `+` / `00` number that maps to another country). `country` is ISO-3166 alpha-2; `dial` includes `+` (e.g. `"+44"`). Not fired when the host sets `country` in JS. |
| `phone-change` | `{value: string}` | The normalized E.164 string changed (each committed update, including `""` when cleared). |
| `phone-invalid` | `{value: string}` | After user input (or a country change that still has national digits), the composed string is not valid E.164 (`/^\+[1-9]\d{7,14}$/`). |

## Methods

None beyond `HTMLElement` / Lit lifecycle.

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

Shared token sheet: `web/src/components/mode-toggle/theme.ts`.

| `::part()` | Node |
|---|---|
| `field` | Flex row wrapping selector + dial + input |
| `country` | Country `<select>` |
| `dial` | Visible calling-code label (`+1`, `+44`, …) |
| `input` | National `<input type="tel">` |

Invalid (nonempty non-E.164) numbers set `data-invalid="true"` on `part="field"` and `aria-invalid="true"` on the tel input (border uses `--tobor-kit-danger`).

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix `phone`. No `data-testid` on this tag. Hooks live in Shadow DOM.

| Hook | Node |
|---|---|
| `phone.country` | Country `<select>` |
| `phone.dial` | Dial-code `<span>` (`+<dial>`) |
| `phone.input` | National `<input type="tel">` |

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Light-DOM class hooks are not part of this island.
