# tobor-review-panel

Shadow-DOM review thread for an artifact: a list of host-owned reviews plus an optional composer. Emits `review-submit` / `review-resolve`; the **host** loads and persists. Does not fetch.

Entry from `<tobor-artifact-view>` is `review-start`. This tag is the list/thread view the host mounts after that.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/review-panel/review-panel.js"></script>

<tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>
```

```js
el.reviews = [{id: 'r1', author: 'Ada', body: 'Looks good', at: '2026-01-01T00:00:00Z', status: 'open'}];
el.addEventListener('review-submit', (event) => {
  // event.detail = {artifactId, body} — host owns POST
});
el.addEventListener('review-resolve', (event) => {
  // event.detail = {id} — host owns persist
});
```

`reviews` is a JS property (`propertyOnly`) — never an HTML attribute.

Full options: [docs/configuration.md](docs/configuration.md). Host contract: [docs/backend-requirements.md](docs/backend-requirements.md). Mount snippets: [examples/README.md](examples/README.md).

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `reviews` | Array | no | `[]` | `{id, author, body, at?, status?: 'open'\|'resolved'}[]` (property-only) |
| `artifact-id` | String | no | `""` | Artifact this thread belongs to |
| `show-composer` | Boolean | no | `true` | Render composer. `show-composer="false"` hides it |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `review-submit` | `{artifactId, body}` | Composer submit |
| `review-resolve` | `{id}` | Resolve on an open row |

## data-cy

`review.panel` `review.item` `review.composer` `review.submit`

## Theming

Shadow DOM. Shared `--tobor-kit-*` tokens (see `web/README.md`).

- `--tobor-kit-review-max-height` — `24rem` (scrollable list)
