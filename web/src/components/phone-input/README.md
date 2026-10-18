# noizu-phone-input

Shadow-DOM phone field: ISO-3166 country selector + national number. `value` is in-kit E.164 (`+<dial><national-digits>`). No libphonenumber-js.

Full options: [docs/configuration.md](docs/configuration.md). Backend:
[docs/backend-requirements.md](docs/backend-requirements.md) (none — host
validates uniqueness / OTP). Mount snippets: [examples/README.md](examples/README.md).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/phone-input/noizu-phone-input.js"></script>

<noizu-phone-input country="US" name="phone"></noizu-phone-input>
```

```js
el.addEventListener('phone-change', (event) => {
  // event.detail.value is E.164, e.g. "+15551234567"
});
```

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `country` | String | no | `US` | ISO-3166 alpha-2; unknown → US |
| `mobile-only` | Boolean | no | `false` | Digit-only; `inputmode=tel`, `autocomplete=tel-national` |
| `name` | String | no | — | Forwarded to the inner tel input |
| `disabled` | Boolean | no | `false` | Disable selector and input |
| `value` | String | no | — | E.164; reflects as `value` |
| `described-by` | String | no | `""` | Forwarded to the inner `<input>` as `aria-describedby`. Point it at an id in the **same tree scope** (e.g. a sibling element the host renders) — setting `aria-describedby` on this element's own tag cannot cross into its inner shadow DOM. |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `country-change` | `{country, dial}` | User picks a country (`dial` is `+1`, `+44`, …) |
| `phone-change` | `{value}` | Normalized E.164 updates |
| `phone-invalid` | `{value}` | Composed number is not valid E.164 |

## data-cy

`phone.input` `phone.country` `phone.dial`

## Theming

Shadow DOM. Consumes shared `--tobor-kit-*` tokens (`theme.ts`). Parts: `field`, `country`, `dial`, `input`.
