# Configuration — asset family

Tags: `tobor-asset-view`, `tobor-asset-editor`.

Shadow-DOM islands. The host injects an asset snapshot as a JS property. The kit does not persist, fetch, or inject HTML (`unsafeHTML` is never used).

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Shared `asset` property

Both tags take the same **property-only** object (`attribute: false`). Never serialized as an HTML attribute.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes (when set) | Host identity. Emitted on `asset-open` / `asset-save`. |
| `name` | `string` | yes (when set) | Display / download filename; editor draft. |
| `mime` | `string` | yes (when set) | MIME type. Parameters after `;` are ignored (`text/plain; charset=utf-8` → text). |
| `src` | `string` | no | Image `src` or download `href`. `javascript:` URLs are rejected. |
| `body` | `string` | no | Inline text for `text/*` preview/edit. Host-loaded. Rendered as text, never HTML. |
| `meta` | `object` | no | Host bag. Not rendered. |

Mime routing: `image/*` → image, `text/*` → text, anything else → download/name fallback.

## `tobor-asset-view`

Mime-aware preview. Empty `asset` shows **No asset**.

### Properties / attributes

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `asset` | `Asset` (object) | no | — | no | **Property-only**. See table above. |

### Events

Bubbling, composed `CustomEvent`s via kit `emit()`.

| Name | Detail | When |
|---|---|---|
| `asset-open` | `{id: string}` | Click on the view except the download `<a>`. Omitted when `asset.id` is missing. Host may ignore. |

### Methods

None beyond `HTMLElement` / Lit lifecycle.

### Slots

None.

## `tobor-asset-editor`

Name field always. `<textarea>` only when `mime` is `text/*`. Save is disabled until `asset.id` is set. Drafts reset when the `asset` reference changes. The element does not write storage or call a server.

### Properties / attributes

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `asset` | `Asset` (object) | no | — | no | **Property-only**. Same shape as the view. |

### Events

| Name | Detail | When |
|---|---|---|
| `asset-save` | `{id: string, name: string, body?: string}` | Save / form submit. `body` is present only for `text/*` (may be `""`). Host persists. |

### Methods

None beyond `HTMLElement` / Lit lifecycle.

### Slots

None.

## CSS custom properties / `::part()`

Shadow DOM. Tokens from `mode-toggle/theme` (`toborKitTokens`, `toborKitControls`).

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-font-family` | system UI stack | Font |
| `--tobor-kit-bg` | `#12131a` | Text `<pre>` / field fill |
| `--tobor-kit-surface` | `#1b1d27` | Frame / form background |
| `--tobor-kit-fg` | `#e8e9f0` | Foreground |
| `--tobor-kit-muted` | `#9aa0b4` | Name, empty copy, fallback |
| `--tobor-kit-accent` | `#6ee7c7` | Download link, focus, save hover |
| `--tobor-kit-accent-fg` | `#08130f` | Pressed control foreground |
| `--tobor-kit-border` | `#2c2f3d` | Frame / field border |
| `--tobor-kit-radius` | `12px` | Frame radius |
| `--tobor-kit-gap` | `12px` | Stack gap |

| `::part()` | Tag | On |
|---|---|---|
| `view` | view | Outer article |
| `name` | both | Display name (view) / name input (editor) |
| `preview` | view | `img`, `pre`, or fallback |
| `download` | view | Download `<a>` (other mime with `src`) |
| `editor` | editor | Form |
| `body` | editor | Textarea (`text/*` only) |
| `save` | editor | Save button |

No Light-DOM class hooks.

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix `asset`. No `data-testid` on these tags. Hooks live in Shadow DOM.

| Hook | Tag | Control |
|---|---|---|
| `asset.view` | `tobor-asset-view` | Outer article |
| `asset.preview` | `tobor-asset-view` | Preview node (`data-kind` is `image` \| `text` \| `other`) |
| `asset.editor` | `tobor-asset-editor` | Form |
| `asset.save` | `tobor-asset-editor` | Save `<button type="button">` |

## Theming

Shadow DOM — restyle through the `--tobor-kit-*` tokens and `::part(...)`. Do not pierce the shadow tree. Light DOM is not used.
