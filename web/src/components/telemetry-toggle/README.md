# tobor-telemetry-toggle

Opt-in/out control for telemetry consent; renders nothing when consent is not overridable.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/telemetry-toggle/telemetry-toggle.js"></script>

<tobor-telemetry-toggle></tobor-telemetry-toggle>
```

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `client` | Object | no | — | One of `client`/`consent` (property-only) |
| `consent` | Object | no | — | Direct TelemetryConsent; one of `client`/`consent` (property-only) |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `tobor-telemetry-change` | `{consent}` | After a successful PUT, or on 403 revert |

## Theming

Consumes the shared `--tobor-kit-*` tokens (see `web/README.md`).
