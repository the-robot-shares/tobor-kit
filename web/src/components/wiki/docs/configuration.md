# wiki family — configuration

Shadow DOM. Hosts own load and persistence. Markup / XHTML / NPL in `entry.body`
is rendered as **text** (no `unsafeHTML`); the read view `<pre>` `pre-wrap`s.
Source characters stay source.

## Tags

| Tag | Role |
|---|---|
| `tobor-wiki-space` | Space roster. Emits `wiki-space-select`. |
| `tobor-wiki-entry` | Read view for one page. Emits `wiki-edit`. |
| `tobor-wiki-entry-editor` | Title + body editor. Emits `wiki-save`. Host persists. |

Primary playground tag (`configurator`): `tobor-wiki-entry`. All three:
`configurators`.

## Properties / attributes

### `tobor-wiki-space`

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `spaces` | `WikiSpace[]` | no | `[]` | no | Property-only. `{id, title, slug?}[]`. Host loads. |
| `selected-id` (`selectedId`) | `string` | no | `""` | no | HTML attribute. Highlighted id. Also set locally on select. |

`WikiSpace`: `{id: string, title: string, slug?: string}`. Empty / non-array
`spaces` shows “No spaces.” Empty `id` does not emit.

### `tobor-wiki-entry`

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `entry` | `WikiEntry \| null` | no | `null` | no | Property-only. `{id, title, body, spaceId?}`. |

`null` entry shows “No entry.” Body is `wikiPlainText` into `<pre>` — never
parsed as HTML. Edit is disabled without `id`.

### `tobor-wiki-entry-editor`

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `entry` | `WikiEntry \| null` | no | `null` | no | Property-only. Seeds title + body. `spaceId` is pass-through on save. |

Changing `entry` resets drafts. Title and body are the only editable fields.

## Events

| Event | Tag | Detail | When |
|---|---|---|---|
| `wiki-space-select` | `tobor-wiki-space` | `{id: string}` | Space button click. Host loads the entry. |
| `wiki-edit` | `tobor-wiki-entry` | `{id: string}` | Edit click. Host shows the editor. |
| `wiki-save` | `tobor-wiki-entry-editor` | `{id, title, body, spaceId?}` | Save click. Host persists. `spaceId` omitted when unset. Empty `id` is a host create. |

Bubbles, composed. The islands do **not** fetch or write.

## Methods

None.

## Slots

None.

## CSS custom properties / `::part()`

Inherited kit tokens (`--tobor-kit-bg`, `--tobor-kit-surface`, `--tobor-kit-fg`,
`--tobor-kit-muted`, `--tobor-kit-accent`, `--tobor-kit-accent-fg`,
`--tobor-kit-border`, `--tobor-kit-radius`, `--tobor-kit-gap`, …) — see
`web/README.md`. Shared sheet: `web/src/components/mode-toggle/theme.ts`.

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-wiki-body-max-height` | `24rem` | Max height of the entry `[part="body"]` `<pre>` |

| Tag | `::part()` | Node |
|---|---|---|
| `tobor-wiki-space` | `root` | `<nav>` |
| `tobor-wiki-space` | `item` | Space `<button>` |
| `tobor-wiki-entry` | `root` | Outer `<article>` |
| `tobor-wiki-entry` | `title` | `<h2>` |
| `tobor-wiki-entry` | `space` | Optional `spaceId` line |
| `tobor-wiki-entry` | `body` | Body `<pre>` |
| `tobor-wiki-entry` | `edit` | Edit `<button>` |
| `tobor-wiki-entry-editor` | `root` | Outer `<article>` |
| `tobor-wiki-entry-editor` | `title` | Title `<input>` |
| `tobor-wiki-entry-editor` | `body` | Body `<textarea>` |
| `tobor-wiki-entry-editor` | `save` | Save `<button>` |

## `data-cy` / `data-testid`

Registry `cy_prefix`: `wiki`. Hooks live in each element's Shadow DOM.

| Hook | Selector | Tag | When |
|---|---|---|---|
| `wiki.space` | `[data-cy="wiki.space"]` | `tobor-wiki-space` | Always |
| `wiki.space-item` | `[data-cy="wiki.space-item"]` | `tobor-wiki-space` | One per space (`data-space-id`) |
| `wiki.entry` | `[data-cy="wiki.entry"]` | `tobor-wiki-entry` | Always |
| `wiki.editor` | `[data-cy="wiki.editor"]` | `tobor-wiki-entry-editor` | Always |
| `wiki.save` | `[data-cy="wiki.save"]` | `tobor-wiki-entry-editor` | Always |

No `data-testid` hooks. Prefix freeze: `wiki`.

## Theming

**Shadow DOM.** Restyle through CSS variables on the host (or ancestors) and
`::part()`. Do not pierce these shadow roots. Body HTML/XHTML/NPL is escaped
text with `pre-wrap` on the read-view `<pre>`.
