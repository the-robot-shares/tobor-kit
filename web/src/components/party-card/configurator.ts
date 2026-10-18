import type {ConfiguratorCssVariable, ConfiguratorSchema} from '../../configurator-schema.js';

const cssVariables: ConfiguratorCssVariable[] = [
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
  {name: '--tobor-kit-party-avatar-size', default: '48px'},
];

const partyFields: ConfiguratorSchema['fields'] = [
  {
    attr: 'display-name',
    type: 'string',
    default: '',
    description: 'Visible party name.',
  },
  {
    attr: 'handle',
    type: 'string',
    default: '',
    description: 'Handle / username (rendered as given).',
  },
  {
    attr: 'presence',
    type: 'select',
    options: ['online', 'away', 'offline', 'hidden'],
    default: 'offline',
    description: 'Presence dot. Unknown values clamp to offline. hidden conceals the indicator.',
  },
];

export const partyCard: ConfiguratorSchema = {
  tag: 'tobor-party-card',
  group: 'agent',
  importPath: 'components/party-card/party-card.js',
  demoHtml:
    '<tobor-party-card display-name="Nova" handle="@nova" presence="online"><tobor-robot-avatar slot="avatar" state="idle" label="Nova"></tobor-robot-avatar></tobor-party-card>',
  backend: 'none',
  fields: partyFields,
  slots: ['avatar', 'badges', 'actions'],
  events: [],
  cssVariables,
  methods: [],
};

export const agentCard: ConfiguratorSchema = {
  tag: 'tobor-agent-card',
  group: 'agent',
  importPath: 'components/party-card/agent-card.js',
  demoHtml:
    '<tobor-agent-card display-name="Nova" handle="@nova" presence="online" agent-id="nova" model-badge="gpt-4o"><tobor-robot-avatar slot="avatar" state="idle" label="Nova"></tobor-robot-avatar></tobor-agent-card>',
  backend: 'none',
  fields: [
    ...partyFields,
    {
      attr: 'agent-id',
      type: 'string',
      default: '',
      description: 'Agent identifier. Chat CTA emits this as agent-chat.detail.agentId.',
    },
    {
      attr: 'model-badge',
      type: 'string',
      default: '',
      description: 'Model / provider badge copy (e.g. gpt-4o). Omitted when empty.',
    },
    {
      attr: 'show-capabilities',
      type: 'boolean',
      default: true,
      description: 'Show capability chips. HTML show-capabilities="false" hides them.',
    },
    {
      attr: 'capabilities',
      type: 'tag-list',
      propertyOnly: true,
      default: [],
      description: 'Capability chips (string[]). JS property — not an HTML attribute.',
    },
  ],
  slots: ['avatar', 'badges', 'actions'],
  events: [
    {
      name: 'agent-chat',
      detail: '{agentId: string}',
      description: 'Chat clicked. Host opens the conversation. The island does not navigate.',
    },
  ],
  cssVariables,
  methods: [],
};

export const userCard: ConfiguratorSchema = {
  tag: 'tobor-user-card',
  group: 'agent',
  importPath: 'components/party-card/user-card.js',
  demoHtml:
    '<tobor-user-card display-name="Keith" handle="@keith" presence="away" user-id="keith" role="Owner" org="Noizu"></tobor-user-card>',
  backend: 'none',
  fields: [
    ...partyFields,
    {
      attr: 'user-id',
      type: 'string',
      default: '',
      description: 'User identifier. Profile CTA emits this as user-profile.detail.userId.',
    },
    {
      attr: 'role',
      type: 'string',
      default: '',
      description: 'Role badge. Omitted when empty.',
    },
    {
      attr: 'org',
      type: 'string',
      default: '',
      description: 'Organization badge. Omitted when empty.',
    },
  ],
  slots: ['avatar', 'badges', 'actions'],
  events: [
    {
      name: 'user-profile',
      detail: '{userId: string}',
      description: 'Profile clicked. Host opens the profile. The island does not navigate.',
    },
  ],
  cssVariables,
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [partyCard, agentCard, userCard];
export const configurator = agentCard;
