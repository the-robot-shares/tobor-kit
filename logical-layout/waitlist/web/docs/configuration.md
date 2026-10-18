# Configuration — noizu-waitlist

Tags in this family: **`noizu-waitlist`**.

Light-DOM island. Render replaces children; there is no projected slot. Hosts own redirects, cookies, and persistence. The element carries no secrets.

See also [backend-requirements.md](backend-requirements.md) and [../README.md](../README.md).

## Properties / attributes

Resolution for `slug`, `service`, `list`, `api`, and `source`: HTML attribute → element property → `data-foryou-*` alias attribute / `foryou*` property.

None of the attributes reflect back to the DOM (`reflect` is false).

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `slug` | `string` | no | `""` | no | List key. If set, GET/POST `{api}/api/v1/public/lists/{slug}`. Wins over `service`+`list`. |
| `service` | `string` | no | `""` | no | With `list` when `slug` is empty: `{api}/api/v1/public/services/{service}/lists/{list}`. |
| `list` | `string` | no | `""` | no | Used with `service`. |
| `api` | `string` | no | `https://foryou.therobotlives.com` | no | Origin only (no trailing path). Empty / whitespace falls back to the default. |
| `source` | `string` | no | `widget` | no | Sent as `source` on POST `/signups`. |
| `data-foryou-slug` | `string` | no | `""` | no | Alias property `foryouSlug`. |
| `data-foryou-service` | `string` | no | `""` | no | Alias property `foryouService`. |
| `data-foryou-list` | `string` | no | `""` | no | Alias property `foryouList`. |
| `data-foryou-api` | `string` | no | `""` | no | Alias property `foryouApi`. |
| `data-foryou-source` | `string` | no | `""` | no | Alias property `foryouSource`. |

Without `slug` and without both `service` and `list`, the island does not fetch. It renders a fallback required email field (`slug: email`, `type: email`).

URL query params whose keys match an attribute `slug` prefill that control. For `guid` fields, `invite_token`, `token`, `ref`, and `invite` are also read.

## Events

Bubbling, composed `CustomEvent`s.

| Event | Detail | When |
|---|---|---|
| `waitlist-success` | `{values, status, source}` | Signup POST completed with a non-4xx status. ForYou returns **202**. `values` is the coerced field map (honeypot omitted). |
| `waitlist-error` | `{error, status, values?}` | Manifest GET not OK / network error (`values` omitted), or signup 4xx/5xx / network error (`values` included). `status` is the HTTP code or `null`. |

## Methods

None beyond `HTMLElement` / Lit lifecycle.

## Slots

None. `registry.yaml` lists `default`; the template does not render `<slot>` and overwrites light-DOM children each render.

## CSS custom properties / `::part()`

None. Light DOM (`createRenderRoot()` returns `this`). No shadow parts.

Host-page classes the markup uses (frozen in `registry.yaml`):

| Class | Where |
|---|---|
| `field-group` | Wrapper around each field |
| `field-label` | Label / group title |
| `field-input` | Text-like `<input>` |
| `field-select` | `<select>` |
| `field-textarea` | `type: text` (textarea) |
| `btn` | Submit |
| `success` | Status node after a 2xx/3xx signup |
| `danger` | Status node after a failure |

Hidden honeypot: `<input type="text" name="company_website" hidden tabindex="-1" autocomplete="off" aria-hidden="true">`. Not a `data-cy` hook.

## `data-cy` / `data-testid`

Must match `registry.yaml`. Prefix `waitlist`. No `data-testid` on this tag.

| Hook | Node |
|---|---|
| `waitlist.form` | `<form novalidate>` |
| `waitlist.email` | Control whose attribute `type` is `email` or whose `slug` is `email` |
| `waitlist.submit` | Submit `<button type="submit">` |
| `waitlist.status` | `role="status"` live region (loading, success, error, idle) |

## Theming

Style the classes above from the host page (or a styleguide sheet). Do not add CSS variables or a closed shadow tree to this island. Submit label is `Join` / `Joining…` while `busy`.
