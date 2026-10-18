import type {ConfiguratorSchema} from '../../configurator-schema.js';

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
  tag: 'tobor-mcp-config',
  group: 'agent',
  importPath: 'components/mcp-config/tobor-mcp-config.js',
  demoHtml: '<tobor-mcp-config url="https://mcp.example.test/mcp" transport="http"></tobor-mcp-config>',
  backend: 'none',
  fields: [
    {
      attr: 'url',
      type: 'string',
      default: '',
      placeholder: 'https://mcp.example.test/mcp',
      description: 'HTTP/SSE endpoint or stdio command path. Host validates. Reflects.',
    },
    {
      attr: 'transport',
      type: 'select',
      options: ['stdio', 'http', 'sse'],
      default: 'http',
      description: 'MCP transport. Host persists. Reflects.',
    },
    {
      attr: 'extras',
      type: 'json',
      propertyOnly: true,
      description:
        'Optional non-secret extras object passed through on config-change. Never tokens, env, or Authorization. Not an HTML attribute.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'config-change',
      detail: '{url: string, transport: "stdio"|"http"|"sse", extras?: object}',
      description: 'Save clicked. Host validates and persists. extras omitted when empty. Bubbles, composed.',
    },
  ],
  cssVariables: tokens,
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
