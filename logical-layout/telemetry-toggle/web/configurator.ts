import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-telemetry-toggle',
  group: 'agent',
  importPath: 'components/telemetry-toggle/telemetry-toggle.js',
  demoHtml: '<tobor-telemetry-toggle></tobor-telemetry-toggle>',
  backend: 'elixir',
  fields: [
    {
      attr: 'client',
      type: 'json',
      propertyOnly: true,
      description:
        'ToborKitClient used to GET/PUT /telemetry/consent. Omit to drive via consent.',
    },
    {
      attr: 'consent',
      type: 'json',
      propertyOnly: true,
      description:
        'TelemetryConsent. Provide to render without API access. One of client/consent.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tobor-telemetry-change',
      detail: '{consent}',
      description: 'After a successful PUT, or on 403 revert to inert.',
    },
  ],
  cssVariables: [
    {name: '--tobor-kit-muted', default: '#9aa0b4'},
    {name: '--tobor-kit-accent', default: '#6ee7c7'},
    {name: '--tobor-kit-danger', default: '#ff6b6b'},
    {name: '--tobor-kit-warn', default: '#f5c451'},
    {name: '--tobor-kit-radius', default: '12px'},
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
