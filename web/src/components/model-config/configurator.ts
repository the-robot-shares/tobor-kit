import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-model-config',
  group: 'input',
  importPath: 'components/model-config/noizu-model-config.js',
  demoHtml:
    '<noizu-model-config value="openai:gpt-4o" inherit allow-custom allow-budget></noizu-model-config>',
  backend: 'none',
  fields: [
    {
      attr: 'catalog',
      type: 'json',
      propertyOnly: true,
      default: [],
      description:
        'Catalog entries `{provider, model, label?, spec?}[]`. Not an HTML attribute. Wins over catalog-url.',
    },
    {
      attr: 'catalog-url',
      type: 'url',
      description:
        'GET JSON catalog. Array or `{catalog|models|entries}`. Optional `{custom}` may echo a masked apiKey (`••••1234`).',
    },
    {
      attr: 'value',
      type: 'string',
      default: '',
      description: '`provider:model` spec. Empty means inherit when `inherit` is set. Reflects.',
    },
    {
      attr: 'inherit',
      type: 'boolean',
      default: false,
      description: 'Show an Inherit option. Host owns nearest-ancestor-wins; the island does not walk the tree.',
    },
    {
      attr: 'allow-custom',
      type: 'boolean',
      default: false,
      description: 'OpenAI-compatible base URL + model + key. Empty key on save means keep stored.',
    },
    {
      attr: 'allow-budget',
      type: 'boolean',
      default: false,
      description: 'Show a simple budget number input.',
    },
    {
      attr: 'budget',
      type: 'number',
      description: 'Current budget amount. Unit is host-owned (e.g. TRK monthly_budget_cents).',
    },
    {
      attr: 'customEndpoint',
      type: 'json',
      propertyOnly: true,
      description:
        '{baseUrl, model, apiKey?}. apiKey may be a masked echo. Never an HTML attribute. Never log.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'model-change',
      detail: '{value: string}',
      description: 'Picker changed. `value` is a spec, `custom:<model>`, or `""` (inherit).',
    },
    {
      name: 'custom-endpoint-save',
      detail: '{baseUrl: string, model: string, apiKey: string}',
      description:
        'Save endpoint. Empty apiKey means keep the stored key. Never log apiKey.',
    },
    {
      name: 'budget-change',
      detail: '{amount: number}',
      description: 'Budget number committed (change).',
    },
  ],
  cssVariables: [
    {name: '--tobor-kit-font-family', default: 'system-ui, -apple-system, "Segoe UI", sans-serif'},
    {name: '--tobor-kit-bg', default: '#12131a'},
    {name: '--tobor-kit-surface', default: '#1b1d27'},
    {name: '--tobor-kit-fg', default: '#e8e9f0'},
    {name: '--tobor-kit-muted', default: '#9aa0b4'},
    {name: '--tobor-kit-accent', default: '#6ee7c7'},
    {name: '--tobor-kit-accent-fg', default: '#08130f'},
    {name: '--tobor-kit-border', default: '#2c2f3d'},
    {name: '--tobor-kit-danger', default: '#ff6b6b'},
    {name: '--tobor-kit-warn', default: '#f5c451'},
    {name: '--tobor-kit-radius', default: '12px'},
    {name: '--tobor-kit-gap', default: '12px'},
    {name: '--tobor-kit-shadow', default: '0 12px 32px rgb(0 0 0 / 35%)'},
    {name: '--tobor-kit-duration', default: '320ms'},
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
