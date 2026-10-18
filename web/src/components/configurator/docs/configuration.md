# tobor-configurator configuration

Tags in this family: `tobor-configurator`.

Schema-driven form generator. The host supplies a `ConfiguratorSchema` (shared type in `web/src/configurator-schema.ts`). The island renders fields, live-previews the target tag, and emits `{tag, attributes, slots}` so the host can insert markup. It does not persist configuration, load the target element's module, or talk to a server except the optional `schema-src` JSON fetch.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `schema` | `ConfiguratorSchema` (`json`) | no | — | n/a | Property-only. Highest priority source. Never an HTML attribute. |
| `schemaSrc` | string | no | `""` | no | HTML attribute `schema-src`. URL of a JSON schema document. `fetch` uses `credentials: 'omit'` and `Accept: application/json`. Relative URLs resolve against `document.baseURI`. |

Resolution order:

1. `schema` property when it has a `tag` and `fields` array
2. Child `<script type="application/json">` (default slot, unread as a visual slot)
3. `schema-src` fetch

The JSON document may be the schema itself, `{configurator: …}`, or `{configurators: […]}` (first entry).

Boolean properties default to `false`. This element has no boolean properties.

## Events

| Name | Detail | When |
|---|---|---|
| `configurator-change` | `{tag: string, attributes: Record<string, unknown>, slots: Record<string, string>}` | After a schema is adopted and after each field edit. Bubbles, composed (`emit()`). |
| `configurator-apply` | same | `apply()` or the Apply control. Bubbles, composed. Host inserts/renders the configured instance. |

`attributes` includes every field value (including `propertyOnly` JSON). `slots` is keyed by slot name; v1 does not generate slot editors — values come from `demoHtml` when present.

## Methods

| Name | Args | Notes |
|---|---|---|
| `apply()` | none | Dispatches `configurator-apply` and returns the snapshot. Does not insert nodes. |

## Slots

| Slot | Required | Notes |
|---|---|---|
| default | no | Host may place `<script type="application/json">` with a `ConfiguratorSchema`. Unslotted light-DOM children are not displayed (Shadow DOM). |

## Field types (consumed schema)

`string`, `text`, `number`, `boolean`, `select`, `multiselect`, `color`, `url`, `tag-list`, `json`.

Modifiers: `required` (marked with `*`, `aria`/HTML `required` on controls), `uneditable` (control disabled, labeled locked), `default`, `options`, `placeholder`, `group` (fieldset legend), `propertyOnly` (JS property on the preview node; omitted from the HTML snippet).

Boolean fields default to `false` when the schema omits `default`.

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

| `::part()` | Node |
|---|---|
| `form` | configuration `<form>` |
| `field` | each field wrapper |
| `preview` | `.demo-frame` live preview |
| `snippet` | copyable HTML `<pre>` |
| `apply` | Apply button |

## `data-cy` / `data-testid`

`cy_prefix`: `configurator`.

| Hook | Target |
|---|---|
| `configurator.form` | form |
| `configurator.preview` | `.demo-frame` preview |
| `configurator.snippet` | HTML snippet `<pre>` |
| `configurator.apply` | Apply button |
| `configurator.field` | each field wrapper; distinguish with `data-field="<attr>"` |

New hooks are `data-cy` only (no `data-testid`).

## Theming

**Shadow DOM** + inherited `--tobor-kit-*` tokens. Light-DOM class hooks are not part of this island. The preview target is created with `document.createElement(schema.tag)` and current attributes/properties; the host must import the target tag if it wants a defined custom element in the frame.
