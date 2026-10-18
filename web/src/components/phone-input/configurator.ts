import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-phone-input',
  group: 'input',
  importPath: 'components/phone-input/noizu-phone-input.js',
  demoHtml: '<noizu-phone-input country="US"></noizu-phone-input>',
  backend: 'none',
  fields: [
    {
      attr: 'country',
      type: 'string',
      default: 'US',
      description: 'ISO-3166 alpha-2. Unknown values fall back to US.',
    },
    {
      attr: 'mobile-only',
      type: 'boolean',
      default: false,
      description: 'Digit-only national input; inputmode=tel, autocomplete=tel-national.',
    },
    {
      attr: 'name',
      type: 'string',
      default: '',
      description: 'Name forwarded to the inner tel input.',
    },
    {
      attr: 'disabled',
      type: 'boolean',
      default: false,
      description: 'Disable country select and number input.',
    },
    {
      attr: 'value',
      type: 'string',
      default: '',
      description: 'E.164 +<dial><national-digits>. Reflects as value.',
    },
    {
      attr: 'described-by',
      type: 'string',
      default: '',
      description:
        'ID(s) of a description element in the same tree scope as the host tag (e.g. a sibling in the parent shadow root). Forwarded onto the inner <input> as aria-describedby, because aria-describedby set on the <noizu-phone-input> host tag itself cannot reach across into this element\'s own shadow DOM.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'country-change',
      detail: '{country: string, dial: string}',
      description: 'User picked a different ISO-3166 country in the selector.',
    },
    {
      name: 'phone-change',
      detail: '{value: string}',
      description: 'Normalized E.164 string updated.',
    },
    {
      name: 'phone-invalid',
      detail: '{value: string}',
      description: 'Current composed number is not a valid E.164 value.',
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
