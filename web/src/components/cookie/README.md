# noizu-cookie-consent / noizu-cookie-settings

Light-DOM cookie consent banner and its settings-reopen button.

Options: [docs/configuration.md](docs/configuration.md). Backend: [docs/backend-requirements.md](docs/backend-requirements.md) (none required). Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-consent.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/cookie/noizu-cookie-settings.js"></script>

<noizu-cookie-consent storage-key="start-app.cookie-consent.v1"></noizu-cookie-consent>
<noizu-cookie-settings>Cookie Settings</noizu-cookie-settings>
```

## noizu-cookie-consent

### Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `storage-key` | String | no | `start-app.cookie-consent.v1` | localStorage key for the consent state |
| `mode` | String | no | `categories` | `categories` \| `essential-all` |

### Events

| Event | Detail | Fired when |
|---|---|---|
| `cookie-consent-change` | `{ConsentState \| null}` | Consent is saved or cleared |
| `start-app:cookie-consent-change` (window alias) | same | Same, dispatched on `window` |

Listens for the window event `cookie-settings-open` to reopen the banner.

## noizu-cookie-settings

No properties. Default slot is the button label (default "Cookie Settings"); clicking dispatches `cookie-settings-open`.

## data-cy

`cookie.banner`, `cookie.accept-all`, `cookie.reject-optional`, `cookie.save`, `cookie.category`, `cookie.settings`

## Theming

Light DOM — styled via host-page CSS on its markup; consumes no CSS custom properties.
