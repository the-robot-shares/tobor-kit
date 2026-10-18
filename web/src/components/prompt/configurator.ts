import type {ConfiguratorSchema} from '../../configurator-schema.js';
import {SAMPLE_DIFF, SAMPLE_HISTORY, SAMPLE_PROMPTS} from './types.js';

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
  {
    name: '--tobor-kit-prompt-body-max-height',
    default: '24rem',
    description: 'Max height of prompt body / diff <pre>',
  },
  {
    name: '--tobor-kit-prompt-diff-min',
    default: '12rem',
    description: 'Minimum column width for side-by-side diff panes',
  },
];

export const library: ConfiguratorSchema = {
  tag: 'tobor-prompt-library',
  group: 'agent',
  importPath: 'components/prompt/tobor-prompt-library.js',
  demoHtml: '<tobor-prompt-library></tobor-prompt-library>',
  backend: 'none',
  fields: [
    {
      attr: 'prompts',
      type: 'json',
      propertyOnly: true,
      required: true,
      default: SAMPLE_PROMPTS,
      description:
        '{id, title, body, starred?}[]. Not an HTML attribute. Host loads the roster and persists prompt-star.',
    },
    {
      attr: 'query',
      type: 'string',
      default: '',
      placeholder: 'Search prompts',
      description: 'Filter string. Matches id, title, or body (case-insensitive). Reflects.',
    },
    {
      attr: 'selected-id',
      type: 'string',
      default: '',
      description: 'Highlighted prompt id. Set by the host after prompt-select.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'prompt-select',
      detail: '{id: string}',
      description: 'A prompt was chosen. Host loads / applies it. Bubbles, composed.',
    },
    {
      name: 'prompt-star',
      detail: '{id: string, starred: boolean}',
      description: 'Star toggled. Host persists. Bubbles, composed.',
    },
  ],
  cssVariables: tokens,
  methods: [],
};

export const history: ConfiguratorSchema = {
  tag: 'tobor-prompt-history',
  group: 'agent',
  importPath: 'components/prompt/tobor-prompt-history.js',
  demoHtml: '<tobor-prompt-history></tobor-prompt-history>',
  backend: 'none',
  fields: [
    {
      attr: 'entries',
      type: 'json',
      propertyOnly: true,
      required: true,
      default: SAMPLE_HISTORY,
      description:
        '{id, title, at, version?, starred?}[]. Not an HTML attribute. Host loads history and persists forks/stars.',
    },
    {
      attr: 'diff',
      type: 'json',
      propertyOnly: true,
      default: SAMPLE_DIFF,
      description:
        '{left?: {label?, body}, right?: {label?, body}}. Side-by-side source text. Hidden when the diff slot has content. Never unsafeHTML.',
    },
  ],
  slots: ['diff'],
  events: [
    {
      name: 'prompt-fork',
      detail: '{id: string}',
      description: 'Fork clicked. Host copies the revision. Bubbles, composed.',
    },
    {
      name: 'prompt-star',
      detail: '{id: string, starred: boolean}',
      description: 'Star toggled. Host persists. Bubbles, composed.',
    },
  ],
  cssVariables: tokens,
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [library, history];
export const configurator = library;
