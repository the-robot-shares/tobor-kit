import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-waitlist',
  group: 'island',
  importPath: 'components/waitlist/noizu-waitlist.js',
  demoHtml: '<noizu-waitlist slug="my-site" source="landing"></noizu-waitlist>',
  backend: 'external',
  fields: [
    {
      attr: 'slug',
      type: 'string',
      placeholder: 'my-site',
      description: 'Public list key. Wins over service+list.',
    },
    {
      attr: 'service',
      type: 'string',
      description: 'Service key used with list when slug is empty.',
    },
    {
      attr: 'list',
      type: 'string',
      description: 'List key used with service when slug is empty.',
    },
    {
      attr: 'api',
      type: 'url',
      default: 'https://foryou.therobotlives.com',
      description: 'API origin. Empty falls back to the ForYou default.',
    },
    {
      attr: 'source',
      type: 'string',
      default: 'widget',
      description: 'Attribution string included in POST /signups.',
    },
    {attr: 'data-foryou-slug', type: 'string', group: 'alias', description: 'Alias for slug'},
    {attr: 'data-foryou-service', type: 'string', group: 'alias', description: 'Alias for service'},
    {attr: 'data-foryou-list', type: 'string', group: 'alias', description: 'Alias for list'},
    {attr: 'data-foryou-api', type: 'string', group: 'alias', description: 'Alias for api'},
    {attr: 'data-foryou-source', type: 'string', group: 'alias', description: 'Alias for source'},
  ],
  slots: [],
  events: [
    {
      name: 'waitlist-success',
      detail: '{values: Record<string, unknown>, status: number, source: string}',
      description: 'Signup POST returned a non-4xx status (ForYou returns 202).',
    },
    {
      name: 'waitlist-error',
      detail: '{error: string, status: number | null, values?: Record<string, unknown>}',
      description: 'Manifest GET failed or signup POST returned 4xx/5xx / network error.',
    },
  ],
  cssVariables: [],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
