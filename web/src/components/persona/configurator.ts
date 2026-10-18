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
  {name: '--tobor-kit-persona-min', default: '16rem'},
];

export const personaCard: ConfiguratorSchema = {
  tag: 'tobor-persona-card',
  group: 'agent',
  importPath: 'components/persona/persona-card.js',
  demoHtml:
    '<tobor-persona-card persona-id="nova" display-name="Nova" handle="@nova"><tobor-robot-avatar slot="avatar" state="idle" label="Nova"></tobor-robot-avatar></tobor-persona-card>',
  backend: 'none',
  fields: [
    {
      attr: 'persona-id',
      type: 'string',
      default: '',
      description: 'Persona identifier. Select CTA emits this as persona-select.detail.personaId.',
    },
    {
      attr: 'display-name',
      type: 'string',
      default: '',
      description: 'Visible persona name (inherited from tobor-party-card).',
    },
    {
      attr: 'handle',
      type: 'string',
      default: '',
      description: 'Handle / username, rendered as given (inherited from tobor-party-card).',
    },
    {
      attr: 'presence',
      type: 'select',
      options: ['online', 'away', 'offline', 'hidden'],
      default: 'offline',
      description: 'Presence dot from tobor-party-card. Unknown values clamp to offline.',
    },
  ],
  slots: ['avatar', 'badges', 'actions'],
  events: [
    {
      name: 'persona-select',
      detail: '{personaId: string}',
      description: 'Select clicked. Host switches persona. The island does not navigate.',
    },
  ],
  cssVariables,
  methods: [],
};

export const personaPicker: ConfiguratorSchema = {
  tag: 'tobor-persona-picker',
  group: 'agent',
  importPath: 'components/persona/persona-picker.js',
  demoHtml: '<tobor-persona-picker query=""></tobor-persona-picker>',
  backend: 'none',
  fields: [
    {
      attr: 'personas',
      type: 'json',
      propertyOnly: true,
      default: [
        {id: 'nova', name: 'Nova', handle: '@nova'},
        {id: 'orbit', name: 'Orbit', handle: '@orbit'},
        {id: 'pip', name: 'Pip'},
      ],
      description:
        'Roster {id, name, handle?}[]. JS property — not an HTML attribute. Host supplies the list.',
    },
    {
      attr: 'query',
      type: 'string',
      default: '',
      placeholder: 'Search personas',
      description: 'Filter string. Matches id, name, or handle (case-insensitive). Reflects.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'persona-select',
      detail: '{personaId: string}',
      description: 'Grid item clicked. Host switches persona. The island does not navigate.',
    },
  ],
  cssVariables,
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [personaCard, personaPicker];
export const configurator = personaPicker;
