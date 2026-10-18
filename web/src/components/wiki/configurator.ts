import type {ConfiguratorSchema} from '../../configurator-schema.js';
import {SAMPLE_ENTRY, SAMPLE_SPACES} from './types.js';

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

export const space: ConfiguratorSchema = {
  tag: 'tobor-wiki-space',
  group: 'agent',
  importPath: 'components/wiki/tobor-wiki-space.js',
  demoHtml: '<tobor-wiki-space></tobor-wiki-space>',
  backend: 'none',
  fields: [
    {
      attr: 'spaces',
      type: 'json',
      propertyOnly: true,
      required: true,
      default: SAMPLE_SPACES,
      description: '{id, title, slug?}[]. Not an HTML attribute. Host loads the roster.',
    },
    {
      attr: 'selected-id',
      type: 'string',
      default: '',
      description: 'Highlighted space id. Set by the host after wiki-space-select.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'wiki-space-select',
      detail: '{id: string}',
      description: 'A space was chosen. Host loads the entry. Bubbles, composed.',
    },
  ],
  cssVariables: tokens,
  methods: [],
};

export const entry: ConfiguratorSchema = {
  tag: 'tobor-wiki-entry',
  group: 'agent',
  importPath: 'components/wiki/tobor-wiki-entry.js',
  demoHtml: '<tobor-wiki-entry></tobor-wiki-entry>',
  backend: 'none',
  fields: [
    {
      attr: 'entry',
      type: 'json',
      propertyOnly: true,
      required: true,
      default: SAMPLE_ENTRY,
      description:
        '{id, title, body, spaceId?}. Not an HTML attribute. Body always renders as text in <pre> (no unsafeHTML). XHTML/NPL stays source.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'wiki-edit',
      detail: '{id: string}',
      description: 'Edit clicked. Host shows tobor-wiki-entry-editor. Bubbles, composed.',
    },
  ],
  cssVariables: [
    ...tokens,
    {
      name: '--tobor-kit-wiki-body-max-height',
      default: '24rem',
      description: 'Max height of the scrollable body <pre>',
    },
  ],
  methods: [],
};

export const editor: ConfiguratorSchema = {
  tag: 'tobor-wiki-entry-editor',
  group: 'agent',
  importPath: 'components/wiki/tobor-wiki-entry-editor.js',
  demoHtml: '<tobor-wiki-entry-editor></tobor-wiki-entry-editor>',
  backend: 'none',
  fields: [
    {
      attr: 'entry',
      type: 'json',
      propertyOnly: true,
      default: SAMPLE_ENTRY,
      description:
        '{id, title, body, spaceId?}. Seeds title + body. Not an HTML attribute. Host persists wiki-save.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'wiki-save',
      detail: '{id: string, title: string, body: string, spaceId?: string}',
      description:
        'Save clicked. Host persists (create/update). Kit does not write. Bubbles, composed.',
    },
  ],
  cssVariables: tokens,
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [space, entry, editor];
export const configurator = entry;
