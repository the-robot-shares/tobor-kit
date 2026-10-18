# wiki family

Shadow-DOM wiki islands. Host loads spaces/entries and persists `wiki-save`.
Body is xhtml-first / NPL **source text** in `<pre>` — never `unsafeHTML`.

Options: [docs/configuration.md](docs/configuration.md). Backend: [docs/backend-requirements.md](docs/backend-requirements.md) (host loads/saves). Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-space.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-entry.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/wiki/tobor-wiki-entry-editor.js"></script>

<tobor-wiki-space></tobor-wiki-space>
<tobor-wiki-entry></tobor-wiki-entry>
<tobor-wiki-entry-editor></tobor-wiki-entry-editor>
```

```js
space.spaces = [{id: 'eng', title: 'Engineering', slug: 'eng'}];
space.addEventListener('wiki-space-select', (event) => {
  // event.detail.id — host loads the entry
});
entry.entry = {id: 'eng-readme', title: 'README', body: '<section>source</section>', spaceId: 'eng'};
entry.addEventListener('wiki-edit', (event) => {
  // event.detail.id — host shows the editor
});
editor.addEventListener('wiki-save', (event) => {
  // event.detail {id, title, body, spaceId?} — host persists
});
```

## tobor-wiki-space

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `spaces` | `{id, title, slug?}[]` | no | `[]` | Property-only roster |
| `selected-id` | String | no | `""` | Highlighted space id |

| Event | Detail | Fired when |
|---|---|---|
| `wiki-space-select` | `{id}` | A space is chosen |

## tobor-wiki-entry

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `entry` | `{id, title, body, spaceId?}` | no | `null` | Property-only read model |

| Event | Detail | Fired when |
|---|---|---|
| `wiki-edit` | `{id}` | Edit is clicked |

## tobor-wiki-entry-editor

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `entry` | `{id, title, body, spaceId?}` | no | `null` | Seeds title + body (property-only) |

| Event | Detail | Fired when |
|---|---|---|
| `wiki-save` | `{id, title, body, spaceId?}` | Save is clicked. Host persists. |

## data-cy

`wiki.space` `wiki.space-item` `wiki.entry` `wiki.editor` `wiki.save`

## Theming

Shadow DOM. Shared `--tobor-kit-*` tokens (see `web/README.md`).

- `--tobor-kit-wiki-body-max-height` — `24rem` (entry `<pre>`)
