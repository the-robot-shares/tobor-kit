# noizu-subscription-gate

Shadow-DOM entitled gate. The default slot renders only when `entitled` is true; otherwise a blocked message and upgrade link are shown. Hosts own entitlement truth, payments, and navigation.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/subscription-gate/noizu-subscription-gate.js"></script>

<noizu-subscription-gate redirect-to="/pricing">
  <p>Subscriber content</p>
</noizu-subscription-gate>
```

Set the `entitled` boolean when the host already knows, and/or `check-url` for an optional same-origin GET (`200` + `{entitled: true}`). `auto-redirect` defaults to false — listen for `gate-blocked` and navigate in the host.

Full options: [docs/configuration.md](docs/configuration.md). Host API: [docs/backend-requirements.md](docs/backend-requirements.md). Mount snippets: [examples/README.md](examples/README.md).

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `entitled` | Boolean | no | `false` | Host-owned. Slot shows only when true. |
| `check-url` | String | no | — | Optional GET. `200` + `{entitled:true}` sets `entitled`. |
| `redirect-to` | String | no | `/pricing` | Blocked link and `gate-blocked.redirectTo`. |
| `auto-redirect` | Boolean | no | `false` | `location.assign` after `gate-blocked` only if the event is not canceled. |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `gate-blocked` | `{redirectTo}` | Not entitled (after optional `check-url`). Cancelable. Before any navigation. |

## Methods

| Name | Args | Notes |
|---|---|---|
| `navigate` | `href: string` | `location.assign` after an uncanceled `gate-blocked` when `auto-redirect` is true. Override to intercept. |

## data-cy

`gate.root` `gate.blocked` `gate.link`

## Theming

Shadow DOM — restyle through `--tobor-kit-*` tokens and `::part(root|blocked|link)`.
