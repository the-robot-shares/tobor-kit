import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-mode-toggle',
  group: 'input',
  importPath: 'components/mode-toggle/mode-toggle.js',
  demoHtml: '<tobor-mode-toggle mode="text"></tobor-mode-toggle>',
  backend: 'none',
  fields: [
    {
      attr: 'modes',
      type: 'json',
      propertyOnly: true,
      default: ['text'],
      description: 'Available modes in display order (GuideMode[]). Not an HTML attribute.',
    },
    {
      attr: 'mode',
      type: 'select',
      options: ['voice', 'text', 'transcript'],
      default: 'text',
      description: 'Active mode.',
    },
    {
      attr: 'disabled',
      type: 'boolean',
      default: false,
      description: 'Disable interaction.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tobor-mode-change',
      detail: '{mode, previous}',
      description: 'Fired when the user selects a different mode.',
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
