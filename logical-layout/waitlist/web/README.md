# noizu-waitlist

Light-DOM waitlist signup form driven by a per-slug manifest.

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/waitlist/noizu-waitlist.js"></script>

<noizu-waitlist slug="my-site" source="landing"></noizu-waitlist>
```

Omit `api` to use `https://foryou.therobotlives.com`. One of `slug` or `service`+`list` fetches the manifest; otherwise the island renders a fallback email field and does not call the API.

Full options: [docs/configuration.md](docs/configuration.md). Host API: [docs/backend-requirements.md](docs/backend-requirements.md). Mount snippets: [examples/README.md](examples/README.md).

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `slug` | String | no | — | List key; `{api}/api/v1/public/lists/{slug}` |
| `service` | String | no | — | With `list`, `{api}/api/v1/public/services/{service}/lists/{list}` |
| `list` | String | no | — | Used with `service` when `slug` is empty |
| `api` | String | no | `https://foryou.therobotlives.com` | API base URL |
| `source` | String | no | `widget` | Attribution source sent on POST |

Resolution order: attribute → property → `data-foryou-*` aliases (`data-foryou-slug`, `data-foryou-service`, `data-foryou-list`, `data-foryou-api`, `data-foryou-source`).

## Events

| Event | Detail | Fired when |
|---|---|---|
| `waitlist-success` | `{values, status, source}` | Signup succeeds (host returns non-4xx, typically 202) |
| `waitlist-error` | `{error, status, values?}` | Manifest or signup fails |

## data-cy

`waitlist.form` `waitlist.email` `waitlist.submit` `waitlist.status`

## Theming

Light DOM — styled via host-page CSS on `.field-group`, `.field-label`, `.field-input`, `.field-select`, `.field-textarea`, `.btn`, `.success`, `.danger`. Consumes no CSS custom properties.
