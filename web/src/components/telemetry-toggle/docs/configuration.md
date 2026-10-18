# tobor-telemetry-toggle — configuration

Full options surface for `<tobor-telemetry-toggle>`. Condensed usage stays in
[README.md](../README.md). Host/API contract: [backend-requirements.md](./backend-requirements.md).

Opt-in/out control for Guide API telemetry consent. Consent is resolved
server-side. When it is not overridable the element **renders nothing** — a
toggle that cannot change anything is a lie in the UI.

## Tags

| Tag | Class | Role |
|---|---|---|
| `tobor-telemetry-toggle` | `ToborTelemetryToggle` | Consent checkbox; primary (only) tag |

## Properties / attributes

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `client` | `ToborKitClient` (json) | no | — | no | **propertyOnly.** Used to `GET`/`PUT /telemetry/consent`. Omit to drive via `consent`. |
| `consent` | `TelemetryConsent` (json) | no | — | no | **propertyOnly.** Direct state; skips the fetch when set before connect. One of `client` / `consent`. |
| `overridable` | `boolean` | — | `false` without consent | no | Read-only getter. `true` when `source !== "forced"` and `user_overridable !== false`. |

Neither `client` nor `consent` is an HTML attribute. Do not serialize them onto the tag.

Without both, or while a `client` fetch is in flight, the element renders nothing.

`TelemetryConsent`:

| Field | Type | Notes |
|---|---|---|
| `enabled` | `boolean` | Resolved value that governs content capture |
| `source` | `"user"` \| `"default"` \| `"forced"` | `forced` = no user choice |
| `user_overridable` | `boolean` | `false` whenever `source` is `forced` |
| `capture` | `{prompt?, response?, tool_args?, tool_results?}` | Optional; unused by the toggle UI |

## Events

| Event | Detail | When |
|---|---|---|
| `tobor-telemetry-change` | `{consent: TelemetryConsent}` | After a successful `PUT`, **or** after a `403` revert to inert |

Bubbles, composed. The host never needs to read Shadow DOM.

On `403` the element rewrites `consent` to `source: "forced"`, `user_overridable: false` (keeping the previous `enabled` when it has one) and then renders nothing.

## Methods

None besides the `overridable` getter above. There is no public `load()` / `toggle()` API — the host sets `client` or `consent` and listens for `tobor-telemetry-change`.

## Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Restyle through kit tokens on `:host` or an ancestor; do not pierce the shadow root.

| Token | Default | Used for |
|---|---|---|
| `--tobor-kit-muted` | `#9aa0b4` | Label copy |
| `--tobor-kit-accent` | `#6ee7c7` | Checkbox accent |
| `--tobor-kit-danger` | `#ff6b6b` | Load-error notice |
| `--tobor-kit-warn` | `#f5c451` | Notice border |
| `--tobor-kit-radius` | `12px` | Notice radius |

| `::part()` | Node |
|---|---|
| `label` | The `<label>` wrapping the checkbox |
| `checkbox` | The `<input type="checkbox">` |

## `data-cy` / `data-testid`

Registry `cy_prefix`: `telemetry`. No frozen `data-cy` hooks yet.

Grandfathered `data-testid` (agent element):

| Hook | Node |
|---|---|
| `telemetry-toggle` | Actionable checkbox (absent when not overridable) |
| `telemetry-error` | Load-error notice (`Could not load telemetry consent: …`) |

## Theming (Shadow + tokens)

The element is Shadow DOM and consumes shared `--tobor-kit-*` tokens (`web/README.md`). Light DOM is not used. Structural hooks are `::part(label)` and `::part(checkbox)`.

## Render contract

| State | Shadow content |
|---|---|
| No `consent` yet, no error | nothing |
| `source === "forced"` or `user_overridable === false` | **nothing** (not a disabled checkbox) |
| Overridable consent | checkbox + label |
| `GET` failed | error notice |
| `PUT` in flight | checkbox remains, `disabled` |
| `PUT` 403 | revert to inert, fire `tobor-telemetry-change` |
