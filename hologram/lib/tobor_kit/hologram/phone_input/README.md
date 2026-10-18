# phone-input family (wave 1)

Mirror of `web/src/components/phone-input/` — contract class B (stateful
interactive). Modules:

- `ToborKit.Hologram.PhoneInput.Input` — the field mirror
- `ToborKit.Hologram.PhoneInput.E164` — **host-side** E.164 helpers
  (`ToborKit.Hologram.Data.DialCodes` = vendored table, wave 0)

**Embed with a `cid`.**

## Usage

```holo
<PhoneInput.Input cid="phone" name="phone" value="+12125550123" target="parent" />

# host side, on :phone_change / :country_change:
e164 = PhoneInput.E164.to_e164(country, national)
if PhoneInput.E164.valid_e164?(e164), do: ... # else fire your :phone_invalid flow
```

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `country` | string | `US` | ISO-3166 alpha-2; unknown → US |
| `mobile_only` | boolean | `false` | digit-only input; `autocomplete=tel-national` |
| `name` | string | `""` | forwarded to the input |
| `described_by` | string | `""` | id for `aria-describedby` |
| `disabled` | boolean | `false` | |
| `value` | string | `""` | E.164 in; split into country + national display (Lit `applyIncomingValue`, adopts parsed country) |
| `target` | string | `parent` | |
| `class` | string | `""` | |

## Event/action contract (per spike decision, PORTING.md §6.1)

Client actions are regex-free: raw input stored, digit filtering via
graphemes only. **Validity is computed host-side** — `phone-invalid` fires
from the host, never the mirror.

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `country-change` | `:country_change` | `%{country, dial}` (dial includes `+`) |
| `phone-change` | `:phone_change` | `%{value}` — **national digits only**, not E.164 (divergence) |
| `phone-invalid` | host-side | host computes with `E164.valid_e164?/1` |

Host canonical form: `E164.to_e164(country_from_last_country_change, national_digits)`.

`E164` (server-only, regex welcome): `valid_e164?/1`, `digits_only/1`,
`to_e164/2`, `parse_e164/2` — ports of the Lit dial-codes functions
(trunk-zero strip, dial-prefix strip, longest-prefix country resolution).

## Theming

`.tk-phone-input__*` (row / country / dial / input); invalid border via
`data-invalid="true"`; disabled opacity via the state-seeded flags.

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `phone.country` | country `<select>` |
| `phone.dial` | `+<dial>` display span |
| `phone.input` | national number `<input>` |

## Divergences from Lit

- **E.164 flow**: Lit emits E.164 on `phone-change` and fires
  `phone-invalid` itself; the mirror emits national digits (client code
  cannot run regex — §6.1) and the host owns validity + invalid signaling.
- **Live invalid flag**: `data-invalid`/`aria-invalid` are seeded at init
  from the `value` prop (server-side regex). They do not re-validate
  client-side per keystroke; the host re-validates via the emitted params.
- No `updated()`/`willUpdate()` two-way sync — the mirror is init-once +
  action-driven (Hologram class-B semantics).

Backend: None. Host owns uniqueness/OTP validation.
