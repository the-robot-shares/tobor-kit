import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-task-menu',
  group: 'agent',
  importPath: 'components/task-menu/task-menu.js',
  demoHtml: '<tobor-task-menu></tobor-task-menu>',
  backend: 'elixir',
  fields: [
    {
      attr: 'inventory',
      type: 'json',
      propertyOnly: true,
      description:
        'ToolInventory from GET /mcp/tools (groups, tools, degraded[]). Null/undefined → "No tasks available." Never an HTML attribute.',
    },
    {
      attr: 'open',
      type: 'boolean',
      default: false,
      description: 'Menu open state. Reflects as the `open` attribute.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tobor-task-select',
      detail: '{tool}',
      description:
        'Fired after a tool is chosen. confirm:true tools confirm inline first. detail.tool is the dressed contract Tool. Advisory — the island does not invoke or authorize the tool.',
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
    {name: '--tobor-kit-shadow', default: '0 12px 32px rgb(0 0 0 / 35%)'},
    {name: '--tobor-kit-font-family', default: 'system-ui, -apple-system, "Segoe UI", sans-serif'},
  ],
  methods: [],
};
