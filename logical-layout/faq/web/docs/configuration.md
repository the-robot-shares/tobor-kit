# noizu-faq configuration

Tags in this family: `noizu-faq`.

Light-DOM FAQ enhancer. The host slots native `<details>` / `<summary>` children; the island decorates them (`hui`, `disclosure`, `disclosure-button`, `disclosure-panel`) and optionally enforces accordion behavior. Do not invent a JSON `items` attribute.

## Properties / attributes

| Name | Type | Required | Default | Reflect | Notes |
|---|---|---|---|---|---|
| `mode` | `'many' \| 'one'` | no | `many` | no | `many` = independent details; `one` = accordion (single open). Observed as an HTML attribute; property writes are not reflected back. |

## Events

| Event | Detail | When |
|---|---|---|
| `faq-toggle` | `{open: boolean, index: number}` | A slotted `<details>` toggles. Bubbles and composed. `index` is the item’s position among adopted details (0-based). |

## Methods

None.

## Slots

| Slot | Required | Notes |
|---|---|---|
| default | yes (for visible items) | Host-supplied `<details>` / `<summary>` entries. Nested markup inside each details is host content. |

## CSS custom properties / `::part()`

None. Light DOM — no shadow parts, no kit tokens.

Host styleguide classes stamped by the island (name freeze: `registry.yaml`):

| Class | Applied to |
|---|---|
| `hui` | list wrapper and each details |
| `disclosure` | each details |
| `disclosure-panel` | each details |
| `disclosure-button` | each summary |

## `data-cy` hooks

| Hook | Target |
|---|---|
| `faq.list` | list wrapper |
| `faq.item` | each slotted `<details>` |
| `faq.trigger` | each `<summary>` |

`cy_prefix`: `faq`.

## Theming

Light DOM (`createRenderRoot` returns `this`). Style via host-page CSS on the stamped classes and native details/summary. The island consumes no CSS custom properties.
