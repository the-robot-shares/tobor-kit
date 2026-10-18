import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-configurator',
  group: 'input',
  importPath: 'components/configurator/tobor-configurator.js',
  demoHtml: `<tobor-configurator>
  <script type="application/json">{"tag":"demo-widget","group":"display","importPath":"demo-widget.js","demoHtml":"<demo-widget label=\\"Hello\\"></demo-widget>","backend":"none","fields":[{"attr":"label","type":"string","required":true,"default":"Hello"},{"attr":"enabled","type":"boolean","default":false}]}</script>
</tobor-configurator>`,
  backend: 'none',
  fields: [
    {
      attr: 'schema',
      type: 'json',
      propertyOnly: true,
      description: 'ConfiguratorSchema object. JS property, not an HTML attribute. Wins over the JSON script and schema-src.',
    },
    {
      attr: 'schema-src',
      type: 'url',
      placeholder: '/components/faq/configurator.json',
      description: 'URL of a JSON ConfiguratorSchema document (credentials omitted).',
    },
  ],
  slots: ['default'],
  events: [
    {
      name: 'configurator-change',
      detail: '{tag, attributes, slots}',
      description: 'Live snapshot after schema load and after each field edit (bubbles, composed).',
    },
    {
      name: 'configurator-apply',
      detail: '{tag, attributes, slots}',
      description: 'Fired by apply() and the Apply button. Host inserts the configured tag.',
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
  methods: [
    {
      name: 'apply',
      args: '',
      description: 'Dispatch configurator-apply with the current {tag, attributes, slots}.',
    },
  ],
};
