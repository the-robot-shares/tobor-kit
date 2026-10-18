# tobor-asset-view / tobor-asset-editor

Shadow-DOM mime-aware asset preview and metadata editor. The host loads the `asset` JS property and persists `asset-save`. The kit does not persist and never injects HTML from an asset body.

Options: [docs/configuration.md](docs/configuration.md). Backend: [docs/backend-requirements.md](docs/backend-requirements.md). Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/asset/asset-view.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/asset/asset-editor.js"></script>

<tobor-asset-view></tobor-asset-view>
<tobor-asset-editor></tobor-asset-editor>
<script type="module">
  const asset = {id: 'note-1', name: 'readme.txt', mime: 'text/plain', body: 'Hello from the host.'};
  const view = document.querySelector('tobor-asset-view');
  const editor = document.querySelector('tobor-asset-editor');
  view.asset = asset;
  editor.asset = asset;
  view.addEventListener('asset-open', (event) => {
    // Optional. Host may open a viewer. Kit does not navigate.
  });
  editor.addEventListener('asset-save', (event) => {
    // Host-owned persist: PUT {id, name, body?} — not a kit API.
  });
</script>
```

`asset` is a JS property (`propertyOnly`) — never an HTML attribute.

## tobor-asset-view

### Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `asset` | Object | no | — | `{id, name, mime, src?, body?, meta?}`. Property-only. |

Preview: `image/*` → `<img>`, `text/*` → `<pre>` (escaped text), other → download link (`src`) or name.

### Events

| Event | Detail | Fired when |
|---|---|---|
| `asset-open` | `{id}` | Preview clicked (not the download link). Optional. |

## tobor-asset-editor

Same `asset` property. Name field always; textarea only for `text/*`.

### Events

| Event | Detail | Fired when |
|---|---|---|
| `asset-save` | `{id, name, body?}` | Save. `body` only for `text/*`. Host persists. |

## data-cy

`asset.view` `asset.preview` `asset.editor` `asset.save`

## Theming

Shadow DOM — restyle through `--tobor-kit-*` tokens and `::part(view|preview|name|download|editor|body|save)`.
