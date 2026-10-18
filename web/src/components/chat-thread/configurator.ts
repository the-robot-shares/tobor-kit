import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-chat-thread',
  group: 'agent',
  importPath: 'components/chat-thread/chat-thread.js',
  demoHtml: '<tobor-chat-thread show-composer pending="working on it…"></tobor-chat-thread>',
  backend: 'elixir',
  fields: [
    {
      attr: 'turns',
      type: 'json',
      propertyOnly: true,
      default: [],
      description: 'Turn[] forwarded to the inner tobor-transcript-view; ignored when messages is nonempty',
    },
    {
      attr: 'messages',
      type: 'json',
      propertyOnly: true,
      default: [],
      description: '{id?, role, text, at?, participant?}[] mapped onto Turn[] with timestamp + participant as plain text',
    },
    {
      attr: 'participants',
      type: 'json',
      propertyOnly: true,
      default: [],
      description: '{id, name}[] roster; resolves message.participant',
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
      description: 'TranscriptStore forwarded to the inner view; presence enables Clear',
    },
    {
      attr: 'pending',
      type: 'string',
      default: '',
      placeholder: 'streaming text',
      description: 'Streaming assistant chunk not yet a turn',
    },
    {
      attr: 'show-composer',
      type: 'boolean',
      default: false,
      description: 'Render the composer; submit emits thread-send {text}',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tobor-transcript-clear',
      detail: '{}',
      description: 'Bubbles from the inner transcript-view after store.clear()',
    },
    {
      name: 'thread-send',
      detail: '{text: string}',
      description: 'Composer submit (show-composer); host owns persistence / POST turn',
    },
  ],
  cssVariables: [
    {name: '--tobor-kit-transcript-height', default: '360px', description: 'Max height of the inner scrollable log'},
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
