import type {ConfiguratorSchema} from '../../configurator-schema.js';
import {SAMPLE_SOURCE} from './highlight.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-npl-view',
  group: 'agent',
  importPath: 'components/npl-view/npl-view.js',
  demoHtml: '<tobor-npl-view></tobor-npl-view>',
  backend: 'none',
  fields: [
    {
      attr: 'source',
      type: 'text',
      default: SAMPLE_SOURCE,
      placeholder: '⌜NPL@1.0⌝',
      description:
        'NPL / prompt-lingua text. String property (also the source attribute). Rendered as escaped spans with CSS highlight classes — never unsafeHTML. Lines starting with # or ⌜NPL become foldable sections.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'npl-copy',
      detail: '{text: string}',
      description:
        'Copy clicked. Detail is the current source. Also writes navigator.clipboard when available. Bubbles, composed.',
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
      name: '--tobor-kit-npl-max-height',
      default: '32rem',
      description: 'Max height of the scrollable source pane',
    },
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
