import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-guide-panel',
  group: 'agent',
  importPath: 'components/guide-panel/guide-panel.js',
  demoHtml:
    '<tobor-guide-panel base-url="/api/tobor-kit" placement="floating"></tobor-guide-panel>',
  backend: 'elixir',
  fields: [
    {
      attr: 'guide',
      type: 'json',
      propertyOnly: true,
      description:
        'GuideProjection. Fetched via GET /guide on connect when omitted. Never an HTML attribute.',
    },
    {
      attr: 'client',
      type: 'json',
      propertyOnly: true,
      description:
        'ToborKitClient. Built from base-url/token when omitted. One of client or base-url required in practice.',
    },
    {
      attr: 'base-url',
      type: 'url',
      placeholder: '/api/tobor-kit',
      description: 'Guide API origin used to construct a client. Defaults to /api/tobor-kit.',
    },
    {
      attr: 'token',
      type: 'string',
      description:
        'Bearer access token. Host-injected from the session; never a provider API key.',
    },
    {
      attr: 'placement',
      type: 'select',
      options: ['floating', 'docked', 'inline'],
      default: 'floating',
      description: 'Overridden by guide.ui.panel.placement when the projection loads.',
    },
    {
      attr: 'start-expanded',
      type: 'boolean',
      default: false,
      description: 'Overridden by guide.ui.panel.start_expanded when the projection loads.',
    },
  ],
  slots: [],
  events: [
    {name: 'tobor-task-invoked', detail: '{task_id}', description: 'A task is selected'},
    {
      name: 'tobor-turn-submitted',
      detail: '{input, task_id?}',
      description: 'A turn is submitted',
    },
    {name: 'tobor-state-change', detail: '{state}', description: 'Each SSE state event'},
    {
      name: 'tobor-turn-error',
      detail: '{error: {code, message}}',
      description: 'A turn fails',
    },
    {name: 'tobor-turn-message', detail: '{turn}', description: 'An assistant turn finalizes'},
  ],
  cssVariables: [
    {
      name: '--tobor-kit-panel-width',
      default: '360px',
      description: 'Floating width. Docked/inline use this as max-width (fallback 480px).',
    },
  ],
  methods: [],
};
