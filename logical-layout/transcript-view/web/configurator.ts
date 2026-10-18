import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-transcript-view',
  group: 'agent',
  importPath: 'components/transcript-view/transcript-view.js',
  demoHtml: '<tobor-transcript-view pending="working on it…"></tobor-transcript-view>',
  backend: 'elixir',
  fields: [
    {
      attr: 'turns',
      type: 'json',
      propertyOnly: true,
      default: [],
      description: 'Turn list; ignored when load.status is not_server_backed',
    },
    {
      attr: 'load',
      type: 'json',
      propertyOnly: true,
      description: '{status: ok | not_server_backed, turns?, has_more?} — 501 is not_server_backed, not empty',
    },
    {
      attr: 'store',
      type: 'json',
      propertyOnly: true,
      description: 'TranscriptStore; presence enables the Clear button',
    },
    {
      attr: 'pending',
      type: 'string',
      default: '',
      placeholder: 'streaming text',
      description: 'Streaming assistant text not yet finalized into a turn',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tobor-transcript-clear',
      detail: '{}',
      description: 'After the transcript is cleared through the store',
    },
  ],
  cssVariables: [
    {name: '--tobor-kit-transcript-height', default: '360px', description: 'Max height of the scrollable log'},
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
