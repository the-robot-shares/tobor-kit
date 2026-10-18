import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-tool-list',
  group: 'agent',
  importPath: 'components/tool-list/tool-list.js',
  demoHtml: '<tobor-tool-list></tobor-tool-list>',
  backend: 'elixir',
  fields: [
    {
      attr: 'inventory',
      type: 'json',
      propertyOnly: true,
      description:
        'Server-dressed ToolInventory from GET /mcp/tools, including degraded[]. Null/absent → "Tools unavailable."',
    },
    {
      attr: 'show-descriptions',
      type: 'boolean',
      default: true,
      description: 'When true, render each tool description under the name.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tobor-tool-select',
      detail: '{tool}',
      description:
        'Fired when a tool row is clicked. detail.tool is the dressed contract Tool. Advisory — does not invoke the tool.',
    },
  ],
  cssVariables: [
    {name: '--tobor-kit-bg', default: '#12131a'},
    {name: '--tobor-kit-fg', default: '#e8e9f0'},
    {name: '--tobor-kit-muted', default: '#9aa0b4'},
    {name: '--tobor-kit-accent', default: '#6ee7c7'},
    {name: '--tobor-kit-accent-fg', default: '#08130f'},
    {name: '--tobor-kit-border', default: '#2c2f3d'},
    {name: '--tobor-kit-warn', default: '#f5c451'},
    {name: '--tobor-kit-radius', default: '12px'},
    {name: '--tobor-kit-font-family', default: 'system-ui, -apple-system, "Segoe UI", sans-serif'},
  ],
  methods: [],
};
