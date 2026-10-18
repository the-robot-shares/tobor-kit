# noizu-model-config

Model picker island (`provider:model` spec). Events up; the host persists.

Full options: [docs/configuration.md](./docs/configuration.md). Backend:
[docs/backend-requirements.md](./docs/backend-requirements.md) (none — host
settings API). Copy-paste hosts: [examples/](./examples/).

May later sit on `tobor-configurator`; v1 is a dedicated picker.

## Usage

```html
<script type="importmap">
  {
    "imports": {
      "lit": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js",
      "lit/decorators.js": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"
    }
  }
</script>
<script type="module">
  import 'https://cdn.derobot.is/tobor-kit/latest/components/model-config/noizu-model-config.js';
</script>

<noizu-model-config id="model" value="openai:gpt-4o" inherit allow-custom allow-budget></noizu-model-config>
<script type="module">
  const el = document.querySelector('#model');
  el.catalog = [
    {provider: 'openai', model: 'gpt-4o', label: 'GPT-4o'},
    {provider: 'anthropic', model: 'claude-3-5', label: 'Claude 3.5'},
  ];
  el.addEventListener('model-change', (event) => {
    /* host persists event.detail.value — empty means inherit */
  });
</script>
```

`catalog` is a JS property, not an HTML attribute. Or set `catalog-url` to GET JSON.

## Properties / attributes

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `catalog` | Array | no | `[]` | `{provider, model, label?}[]` (property-only) |
| `catalog-url` | String | no | `""` | GET JSON catalog |
| `value` | String | no | `""` | `provider:model` spec (reflect). Empty = inherit |
| `inherit` | Boolean | no | `false` | Show Inherit option |
| `allow-custom` | Boolean | no | `false` | Custom OpenAI-compatible endpoint |
| `allow-budget` | Boolean | no | `false` | Budget number input |
| `budget` | Number | no | `null` | Current amount (host units) |
| `customEndpoint` | Object | no | `null` | `{baseUrl, model, apiKey?}` (property-only; apiKey may be masked) |

## Events

| Event | Detail | Fired when |
|---|---|---|
| `model-change` | `{value}` | Picker changes |
| `custom-endpoint-save` | `{baseUrl, model, apiKey}` | Save endpoint. Empty `apiKey` = keep stored. Never log |
| `budget-change` | `{amount}` | Budget input commits |

## Slots / methods

None.

## `::part()` / hooks

`part="picker|custom|budget|save"`. `data-cy`: `model.picker`, `model.custom`, `model.budget`, `model.save`.

## Theming

Shadow DOM. Consumes `--tobor-kit-*` tokens (`theme.ts` / `web/README.md`).
