import type {ConfiguratorSchema} from '../../configurator-schema.js';
import {SAMPLE_INVENTORY, SAMPLE_TOOLS} from './types.js';

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
  tag: 'tobor-mcp-domain',
  group: 'agent',
  importPath: 'components/mcp-domain/tobor-mcp-domain.js',
  demoHtml: '<tobor-mcp-domain></tobor-mcp-domain>',
  backend: 'none',
  fields: [
    {
      attr: 'tools',
      type: 'json',
      propertyOnly: true,
      required: true,
      default: SAMPLE_TOOLS,
      description:
        '{name, visibility}[]. visibility=visible|discoverable|disabled. Not an HTML attribute. Host persists tool-visibility-change.',
    },
    {
      attr: 'inventory',
      type: 'json',
      propertyOnly: true,
      default: SAMPLE_INVENTORY,
      description:
        'Optional dressed ToolInventory. Labels admin rows and feeds the composed tobor-tool-list (visible tools only). Not an HTML attribute.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tool-visibility-change',
      detail: '{name: string, visibility: "visible"|"discoverable"|"disabled"}',
      description: 'A tool visibility select changed. Host persists. Bubbles, composed.',
    },
  ],
  cssVariables: tokens,
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
