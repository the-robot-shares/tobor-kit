# Artifact family configuration

Tags: `tobor-artifact-view`, `tobor-artifact-editor`.

Shadow-DOM islands. Properties down, events up. Body is always text in `<pre>`
(Lit interpolation — **no `unsafeHTML`**). `mime` is a label only; it never
switches the renderer to HTML. The host persists; see
[backend-requirements.md](./backend-requirements.md).

`artifact` is a JS property (`type: json`, `propertyOnly: true`). Never an HTML
attribute.

## `tobor-artifact-view`

Version-aware reader. Assigning a new `artifact` (new `version` / `body`)
re-renders title, version, mime, and body. Start review emits the **current**
`id` + `version`.

### Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `artifact` | `{id, title, version, body, mime?}` (`json`) | no | `null` | n/a | Property-only. Empty/`null` shows “No artifact.” `version` is `string \| number`. `mime` is display-only. |

### Events

| Name | Detail | When |
|---|---|---|
| `review-start` | `{artifactId: string, version: string \| number}` | “Start review” click. Disabled when `artifact` is missing or `id` is empty. Bubbles, composed. |

### Methods

None.

### Slots

None.

## `tobor-artifact-editor`

Editable title + body. Replacing `artifact` reseeds the drafts. Save emits the
drafts plus `id` / optional `version` from the current `artifact`. The island
does not bump `version` or write a store.

### Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `artifact` | `{id, title, version, body, mime?}` (`json`) | no | `null` | n/a | Property-only. Seeds title/body. Missing `id` emits `id: ""` on save (host creates). |

### Events

| Name | Detail | When |
|---|---|---|
| `artifact-save` | `{id: string, title: string, body: string, version?: string \| number}` | Save click. `version` omitted when the seed has none. Bubbles, composed. Host persists. |

### Methods

None.

### Slots

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
| `--tobor-kit-artifact-max-height` | `24rem` (view body `<pre>` only) |

Shared token sheet lives in `web/src/components/mode-toggle/theme.ts`.

| `::part()` | Tag | Node |
|---|---|---|
| `root` | both | wrapping `<article>` |
| `title` | view | `<h2>` |
| `title` | editor | title `<input>` |
| `version` | view | version label |
| `mime` | view | mime label (when set) |
| `body` | view | `<pre>` |
| `body` | editor | body `<textarea>` |
| `review` | view | Start review button |
| `save` | editor | Save button |

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix freeze: `artifact`.

| Hook | Tag | Control |
|---|---|---|
| `artifact.view` | `tobor-artifact-view` | Root article |
| `artifact.review` | `tobor-artifact-view` | Start review |
| `artifact.editor` | `tobor-artifact-editor` | Root article |
| `artifact.save` | `tobor-artifact-editor` | Save |

No `data-testid` hooks.

## Theming

Shadow DOM (default Lit render root). Tokens on `:host` / ancestors. No Light
DOM, no styleguide classes, no piercing selectors.
