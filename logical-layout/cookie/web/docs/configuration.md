# Cookie family configuration

Tags: `noizu-cookie-consent`, `noizu-cookie-settings`.

Light-DOM islands. Host CSS styles the markup (`card`, `btn`, `btn-outline`, `btn-sm`, `hui`, `checkbox-wrap`). No kit HTTP API — see [backend-requirements.md](./backend-requirements.md).

## `noizu-cookie-consent`

Banner shown when no consent is stored, or after `cookie-settings-open`. `mode="categories"` (default) lists four category checkboxes and a Save button. `mode="essential-all"` hides categories and Save; reject copy becomes “Necessary only”.

### Properties / attributes

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `storage-key` (`storageKey`) | string | no | `start-app.cookie-consent.v1` | no | localStorage key |
| `mode` | string | no | `categories` | no | `categories` \| `essential-all` |

### Events

| Name | Detail | When |
|---|---|---|
| `cookie-consent-change` | `ConsentState \| null` | Accept all, reject optional, save, or `storage` event for this key from another tab. Bubbles, composed. |
| `start-app:cookie-consent-change` | same | Window alias of the same payload |

Listens on `window` for `cookie-settings-open` (reopens the banner and loads a draft from stored categories).

`ConsentState` shape:

```json
{
  "version": 1,
  "categories": {
    "necessary": true,
    "analytics": false,
    "marketing": false,
    "preferences": false
  },
  "acceptedAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

`necessary` is always `true` (checkbox disabled). `acceptedAt` is kept from the first save; `updatedAt` is rewritten on every save.

### Methods

None.

### Slots

None.

## `noizu-cookie-settings`

Button that reopens the banner. Does not import the consent element.

### Properties / attributes

None.

### Events

| Name | Detail | When |
|---|---|---|
| `cookie-settings-open` | none | Button click. Bubbles, composed (reaches `window`). |

### Methods

None.

### Slots

| Name | Default | Notes |
|---|---|---|
| default | `Cookie Settings` | Button label |

## CSS custom properties / `::part()`

None. Light DOM — no shadow parts. Host styles these classes (registry freeze):

| Tag | Classes |
|---|---|
| `noizu-cookie-consent` | `card`, `btn`, `btn-outline`, `btn-sm`, `hui`, `checkbox-wrap` |
| `noizu-cookie-settings` | `btn`, `btn-outline`, `btn-sm` |

## `data-cy` / `data-testid`

| Hook | Tag | Control |
|---|---|---|
| `cookie.banner` | `noizu-cookie-consent` | Banner `<section>` |
| `cookie.accept-all` | `noizu-cookie-consent` | Accept all |
| `cookie.reject-optional` | `noizu-cookie-consent` | Reject optional / Necessary only |
| `cookie.save` | `noizu-cookie-consent` | Save (categories mode) |
| `cookie.category` | `noizu-cookie-consent` | Category checkbox (`aria-label` is `{Label} cookies`) |
| `cookie.settings` | `noizu-cookie-settings` | Settings button |

No `data-testid` hooks. Prefix freeze: `cookie` (`registry.yaml`).

## Theming

Light DOM (`createRenderRoot` returns `this`). Style host-page CSS against the markup and styleguide classes above. The elements consume no CSS custom properties and expose no `::part()` names. `:host { display: block }` (consent) and `:host { display: inline-block }` (settings) are the only element styles.
