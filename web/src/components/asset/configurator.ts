import type {ConfiguratorSchema} from '../../configurator-schema.js';

const cssVariables = [
  {name: '--tobor-kit-font-family', default: 'system-ui, -apple-system, "Segoe UI", sans-serif'},
  {name: '--tobor-kit-bg', default: '#12131a'},
  {name: '--tobor-kit-surface', default: '#1b1d27'},
  {name: '--tobor-kit-fg', default: '#e8e9f0'},
  {name: '--tobor-kit-muted', default: '#9aa0b4'},
  {name: '--tobor-kit-accent', default: '#6ee7c7'},
  {name: '--tobor-kit-accent-fg', default: '#08130f'},
  {name: '--tobor-kit-border', default: '#2c2f3d'},
  {name: '--tobor-kit-radius', default: '12px'},
  {name: '--tobor-kit-gap', default: '12px'},
];

const assetField = {
  attr: 'asset',
  type: 'json' as const,
  propertyOnly: true,
  description:
    'Host-owned snapshot {id, name, mime, src?, body?, meta?}. JS property, not an HTML attribute. Kit does not persist.',
  placeholder: '{"id":"note-1","name":"readme.txt","mime":"text/plain","body":"Hello from the host."}',
};

export const view: ConfiguratorSchema = {
  tag: 'tobor-asset-view',
  group: 'display',
  importPath: 'components/asset/asset-view.js',
  demoHtml: '<tobor-asset-view></tobor-asset-view>',
  backend: 'none',
  fields: [assetField],
  slots: [],
  events: [
    {
      name: 'asset-open',
      detail: '{id}',
      description: 'Preview (not the download link) clicked. Optional; host may ignore.',
    },
  ],
  cssVariables,
  methods: [],
};

export const editor: ConfiguratorSchema = {
  tag: 'tobor-asset-editor',
  group: 'input',
  importPath: 'components/asset/asset-editor.js',
  demoHtml: '<tobor-asset-editor></tobor-asset-editor>',
  backend: 'none',
  fields: [assetField],
  slots: [],
  events: [
    {
      name: 'asset-save',
      detail: '{id, name, body?}',
      description: 'Save clicked. Host persists. body is set only for text/* mime.',
    },
  ],
  cssVariables,
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [view, editor];
export const configurator = view;
