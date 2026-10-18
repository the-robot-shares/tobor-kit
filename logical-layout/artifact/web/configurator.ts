import type {ConfiguratorSchema} from '../../configurator-schema.js';
import {SAMPLE_ARTIFACT} from './types.js';

export const view: ConfiguratorSchema = {
  tag: 'tobor-artifact-view',
  group: 'agent',
  importPath: 'components/artifact/tobor-artifact-view.js',
  demoHtml: '<tobor-artifact-view></tobor-artifact-view>',
  backend: 'none',
  fields: [
    {
      attr: 'artifact',
      type: 'json',
      propertyOnly: true,
      required: true,
      default: SAMPLE_ARTIFACT,
      description:
        '{id, title, version, body, mime?}. Not an HTML attribute. Body always renders as text in <pre> (no unsafeHTML). mime is a label only.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'review-start',
      detail: '{artifactId: string, version: string | number}',
      description: 'Start review clicked. Host owns the review flow. Bubbles, composed.',
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
    {
      name: '--tobor-kit-artifact-max-height',
      default: '24rem',
      description: 'Max height of the scrollable body <pre>',
    },
  ],
  methods: [],
};

export const editor: ConfiguratorSchema = {
  tag: 'tobor-artifact-editor',
  group: 'agent',
  importPath: 'components/artifact/tobor-artifact-editor.js',
  demoHtml: '<tobor-artifact-editor></tobor-artifact-editor>',
  backend: 'none',
  fields: [
    {
      attr: 'artifact',
      type: 'json',
      propertyOnly: true,
      default: SAMPLE_ARTIFACT,
      description:
        '{id, title, version, body, mime?}. Seeds title + body. Not an HTML attribute. Host persists artifact-save.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'artifact-save',
      detail: '{id: string, title: string, body: string, version?: string | number}',
      description:
        'Save clicked. Host persists (create/update, version bump). Kit does not write. Bubbles, composed.',
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

export const configurators: ConfiguratorSchema[] = [view, editor];
export const configurator = view;
