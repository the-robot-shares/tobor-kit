import type {ConfiguratorSchema} from '../../configurator-schema.js';
import {SAMPLE_CLIENTS} from './tobor-mcp-clients.js';

const tokens: ConfiguratorSchema['cssVariables'] = [
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
];

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-mcp-clients',
  group: 'agent',
  importPath: 'components/mcp-clients/tobor-mcp-clients.js',
  demoHtml: '<tobor-mcp-clients></tobor-mcp-clients>',
  backend: 'none',
  fields: [
    {
      attr: 'clients',
      type: 'json',
      propertyOnly: true,
      required: true,
      default: SAMPLE_CLIENTS,
      description:
        '{id, name, status, auth: "oauth"|"api-key"}[]. Not an HTML attribute. Host loads the roster. OAuth redirect is host-owned.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'client-authorize',
      detail: '{id: string}',
      description:
        'Authorize clicked. Host starts OAuth (redirect) or collects an API key. Kit does not redirect. Bubbles, composed.',
    },
    {
      name: 'client-revoke',
      detail: '{id: string}',
      description: 'Revoke clicked. Host drops the grant. Bubbles, composed.',
    },
  ],
  cssVariables: tokens,
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
