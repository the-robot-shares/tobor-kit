import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-voice-session',
  group: 'agent',
  importPath: 'components/voice-session/voice-session.js',
  demoHtml: '<tobor-voice-session></tobor-voice-session>',
  backend: 'elixir',
  fields: [
    {
      attr: 'client',
      type: 'json',
      required: true,
      propertyOnly: true,
      description: 'ToborKitClient used to POST /voice/token',
    },
    {
      attr: 'voice',
      type: 'json',
      propertyOnly: true,
      description: 'Guide projection voice block: adapter name plus options',
    },
    {
      attr: 'push-to-talk',
      type: 'boolean',
      default: false,
      description: 'Hold-to-talk when true; click-to-toggle otherwise',
    },
    {
      attr: 'adapterFactory',
      type: 'json',
      propertyOnly: true,
      description: 'Test seam replacing createVoiceAdapter',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tobor-voice-state',
      detail: '{state: GuideState}',
      description: 'Session state changes',
    },
    {
      name: 'tobor-voice-transcript',
      detail: '{entry: {speaker, text, final}}',
      description: 'A transcript entry arrives',
    },
    {
      name: 'tobor-voice-error',
      detail: '{error: {code, message}}',
      description: 'The session errors',
    },
  ],
  cssVariables: [
    {name: '--tobor-kit-accent', default: '#6ee7c7'},
    {name: '--tobor-kit-accent-fg', default: '#08130f'},
    {name: '--tobor-kit-muted', default: '#9aa0b4'},
    {name: '--tobor-kit-danger', default: '#ff6b6b'},
    {name: '--tobor-kit-border', default: '#2c2f3d'},
    {name: '--tobor-kit-fg', default: '#e8e9f0'},
    {name: '--tobor-kit-radius', default: '12px'},
  ],
  methods: [
    {name: 'start', args: '', description: 'Start the voice session'},
    {name: 'stop', args: '', description: 'Stop the voice session'},
    {name: 'sendText', args: 'text: string', description: 'Send text through the adapter'},
  ],
};

export const configurators: ConfiguratorSchema[] = [configurator];
