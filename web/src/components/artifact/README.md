# tobor-artifact-view / tobor-artifact-editor

Version-aware artifact reader and title+body editor. Properties down, events up.
The host persists; the kit does not.

Options: [docs/configuration.md](docs/configuration.md). Backend:
[docs/backend-requirements.md](docs/backend-requirements.md) (none — host store).
Mounts: [examples/](examples/).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-view.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/artifact/tobor-artifact-editor.js"></script>

<tobor-artifact-view id="view"></tobor-artifact-view>
<tobor-artifact-editor id="editor"></tobor-artifact-editor>
<script type="module">
  const artifact = {
    id: 'demo',
    title: 'Release notes',
    version: 1,
    body: 'Ship the island.',
    mime: 'text/plain',
  };
  const view = document.querySelector('#view');
  const editor = document.querySelector('#editor');
  view.artifact = artifact;
  editor.artifact = artifact;
  view.addEventListener('review-start', (event) => {
    /* host starts a review for event.detail {artifactId, version} */
  });
  editor.addEventListener('artifact-save', (event) => {
    /* host persists event.detail {id, title, body, version?} */
  });
</script>
```

`artifact` is a JS property, not an HTML attribute. Body is always text in
`<pre>` — never HTML (`unsafeHTML` is forbidden).

## tobor-artifact-view

### Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `artifact` | Object | yes (to show content) | `null` | `{id, title, version, body, mime?}` (property-only) |

### Events

| Event | Detail | Fired when |
|---|---|---|
| `review-start` | `{artifactId, version}` | Start review is clicked |

## tobor-artifact-editor

### Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `artifact` | Object | no | `null` | Seeds title + body (property-only) |

### Events

| Event | Detail | Fired when |
|---|---|---|
| `artifact-save` | `{id, title, body, version?}` | Save is clicked. Host persists |

## data-cy

`artifact.view`, `artifact.review`, `artifact.editor`, `artifact.save`

## Theming

Shadow DOM. Consumes `--tobor-kit-*` tokens (`theme.ts` / `web/README.md`).
View also reads `--tobor-kit-artifact-max-height` (default `24rem`).
