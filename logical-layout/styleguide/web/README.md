# styleguide family

Shadow-DOM portfolio atoms converted from React `StyleGuideBtn`, `StyleGuideCard`, `StyleGuideCardGrid`, `StyleGuideStatusIndicator`, `StyleGuideInputField`, `StyleGuideSpecTable`, and `StyleGuideStepProgress`. Tokens via `--tobor-kit-*`. Hosts own navigation and persistence.

Tags: **`noizu-sg-btn`**, **`noizu-sg-card`**, **`noizu-sg-card-grid`**, **`noizu-sg-status`**, **`noizu-sg-input`**, **`noizu-sg-spec-table`**, **`noizu-sg-steps`**.

Full options: [docs/configuration.md](docs/configuration.md). Host contract: [docs/backend-requirements.md](docs/backend-requirements.md) (none). Mount snippets: [examples/README.md](examples/README.md).

## Usage

```html
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-btn.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-card.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-card-grid.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-status.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-input.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-spec-table.js"></script>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/styleguide/noizu-sg-steps.js"></script>

<noizu-sg-btn variant="primary" size="md">Continue</noizu-sg-btn>

<noizu-sg-card-grid columns="3">
  <noizu-sg-card href="/plans">
    <span slot="header">Pro</span>
    Compare features
    <span slot="footer">From $9/mo</span>
  </noizu-sg-card>
</noizu-sg-card-grid>

<noizu-sg-status status="ok" label="Ready" description="All checks passed"></noizu-sg-status>
<noizu-sg-input name="email" type="email"></noizu-sg-input>
<noizu-sg-spec-table></noizu-sg-spec-table>
<noizu-sg-steps current="1"></noizu-sg-steps>
<script type="module">
  document.querySelector('noizu-sg-spec-table').rows = [{key: 'Protocol', value: 'HTTPS'}];
  document.querySelector('noizu-sg-steps').steps = ['Plan', 'Build', 'Ship'];
</script>
```

## noizu-sg-btn

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `variant` | String | no | `primary` | `primary` \| `secondary` \| `ghost` \| `danger` |
| `size` | String | no | `md` | `sm` \| `md` \| `lg` |
| `disabled` | Boolean | no | `false` | Native disabled; no `sg-click` |
| `type` | String | no | `button` | `button` \| `submit` |

Default slot = label.

| Event | Detail | Fired when |
|---|---|---|
| `sg-click` | `{}` | Inner button clicked (not when disabled) |

`data-cy`: `sg.btn`

## noizu-sg-card

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `href` | String | no | `""` | Nonempty → surface is an `<a>` |

Slots: `header`, default, `footer`.

| Event | Detail | Fired when |
|---|---|---|
| `sg-card-select` | `{href}` | Card activated. Cancelable — host owns navigation if they `preventDefault`. |

`data-cy`: `sg.card`

## noizu-sg-card-grid

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `columns` | Number | no | `3` | Column count; non-positive/NaN → 3 |

Default slot = cards.

`data-cy`: `sg.grid`

## noizu-sg-status

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `status` | String | no | `idle` | `ok` \| `warn` \| `error` \| `idle` |
| `label` | String | no | `""` | Primary copy (text) |
| `description` | String | no | `""` | Secondary copy (text; hidden when empty) |

`data-cy`: `sg.status`

## noizu-sg-input

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | String | no | `""` | Inner control name |
| `type` | String | no | `text` | `textarea` → `<textarea>`; else input type |
| `disabled` | Boolean | no | `false` | Native disabled; no `sg-input` |
| `error` | Boolean | no | `false` | Invalid treatment |
| `value` | String | no | `""` | Field value |

| Event | Detail | Fired when |
|---|---|---|
| `sg-input` | `{value}` | Inner input (not when disabled) |

`data-cy`: `sg.input`

## noizu-sg-spec-table

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `rows` | `{key, value}[]` | no | `[]` | Property-only. Cells are text only. |

`data-cy`: `sg.spec`

## noizu-sg-steps

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `steps` | `string[]` | no | `[]` | Property-only labels (text) |
| `current` | Number | no | `0` | 0-based current index |

`data-cy`: `sg.steps`

## Theming

Shadow DOM — restyle through `--tobor-kit-*` tokens and `::part(btn|card|header|body|footer|grid|status|dot|label|description|field|table|steps|step|bar|index)`.

## Accessible fields and native framework events

`noizu-sg-input` now accepts `label`, `placeholder`, `help-text`, `error-message`, and `required`; `type="date"` is supported. Existing props and `sg-input` `{value}` events remain unchanged. Provide `label` for an accessible name: it renders a real `<label for="field">` in the same shadow root as the native input/textarea. Help and error text use `aria-describedby`; `error` also sets `aria-invalid`. `focus()` delegates to the native control. Styling parts: `label`, `field`, `help`, `error`.

The new **`noizu-sg-select`** (`import '@noizu/tobor-kit/sg-select'`) uses a native single-select for keyboard and assistive technology behavior. Shared props: `label`, `name`, `value`, `placeholder`, `disabled`, `required`, `error`, `help-text`, `error-message`. Supply `options` as an array property or JSON attribute containing `{value: string, label: string, disabled?: boolean}`. Values should be unique strings. Native platform selection behavior is preserved; no custom keyboard simulation or popup.

```html
<noizu-sg-input label="Decision rationale" type="textarea" help-text="Explain the next step"></noizu-sg-input>
<noizu-sg-select label="Decision" value="defer"
  options='[{"value":"defer","label":"Defer with expiry"},{"value":"waive","label":"Record a waiver"}]'>
</noizu-sg-select>
```

Select emits `sg-change` with `{value}`. Both fields additionally emit one bubbling, composed **native `change` event** after updating `host.value`: input does this per input edit, select on native selection change. Input's later native blur/change is consumed so it cannot duplicate that notification. Programmatic updates emit neither event. Disabled controls suppress these notifications. Frameworks such as Hologram can bind `$change` to the host and read `params.event.value`; choose either the native event or the kit custom event, not both.

**Forms are host-managed.** These components do not claim form association: their shadow controls are not included in an ancestor form's `FormData`, and `required` does not block an ancestor form submission. Read values into host state, validate there, and submit explicitly. Do not associate an outer label with the custom-element host; use the component's `label`. Existing native forms may remain preferable when automatic browser form submission is required.
