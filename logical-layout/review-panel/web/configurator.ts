import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-review-panel',
  group: 'agent',
  importPath: 'components/review-panel/review-panel.js',
  demoHtml: '<tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>',
  backend: 'none',
  fields: [
    {
      attr: 'reviews',
      type: 'json',
      propertyOnly: true,
      default: [],
      description:
        '{id, author, body, at?, status?: open|resolved}[]. Host-owned snapshot. JS property — not an HTML attribute.',
    },
    {
      attr: 'artifact-id',
      type: 'string',
      default: '',
      placeholder: 'artifact-1',
      description: 'Artifact this thread belongs to. Included on review-submit.',
    },
    {
      attr: 'show-composer',
      type: 'boolean',
      default: true,
      description: 'Render the composer. HTML show-composer="false" hides it. Submit emits review-submit {artifactId, body}.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'review-submit',
      detail: '{artifactId: string, body: string}',
      description: 'Composer submit. Host persists. The island does not append locally.',
    },
    {
      name: 'review-resolve',
      detail: '{id: string}',
      description: 'Resolve clicked on an open row. Host persists. The island does not mutate reviews.',
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
    {name: '--tobor-kit-review-max-height', default: '24rem', description: 'Max height of the scrollable review list'},
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
