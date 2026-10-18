import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-robot-avatar',
  group: 'agent',
  importPath: 'components/robot-avatar/robot-avatar.js',
  demoHtml: '<tobor-robot-avatar state="idle" label="Guide"></tobor-robot-avatar>',
  backend: 'none',
  fields: [
    {
      attr: 'state',
      type: 'select',
      options: ['idle', 'listening', 'thinking', 'speaking', 'tool_running', 'error', 'offline'],
      default: 'idle',
      description: 'Canonical guide state. Unknown values clamp to idle.',
    },
    {
      attr: 'renderer',
      type: 'select',
      options: ['glyph', 'sprite', 'lottie'],
      default: 'glyph',
      description: 'glyph is implemented. sprite/lottie fall back to glyph until art is supplied.',
    },
    {
      attr: 'asset',
      type: 'url',
      placeholder: 'https://example.invalid/tobor.png',
      description: 'Sprite sheet or Lottie JSON URL from ui.robot.asset.',
    },
    {
      attr: 'reduced-motion',
      type: 'select',
      options: ['respect', 'force_static', 'ignore'],
      default: 'respect',
      description: 'respect defers to prefers-reduced-motion; force_static never animates; ignore always does.',
    },
    {
      attr: 'label',
      type: 'string',
      default: 'Guide',
      description: 'Accessible name prefix; the resolved state is appended.',
    },
    {
      attr: 'states',
      type: 'json',
      propertyOnly: true,
      description: 'Per-state {segment?, loop?, speed?} hints from ui.robot.states. Not an HTML attribute.',
    },
    {
      attr: 'avatar',
      type: 'json',
      propertyOnly: true,
      description: 'AvatarGroup {id, label?, default?, states?}. Not an HTML attribute.',
    },
  ],
  slots: [],
  events: [],
  cssVariables: [
    {name: '--tobor-kit-robot-size', default: '96px'},
    {name: '--tobor-kit-robot-shell', description: 'Head/torso fill; falls back to --tobor-kit-surface'},
    {name: '--tobor-kit-robot-edge', description: 'Stroke; falls back to --tobor-kit-border'},
    {name: '--tobor-kit-robot-visor', default: '#0d0f16'},
    {name: '--tobor-kit-robot-accent', description: 'Lit features; falls back to --tobor-kit-accent'},
  ],
  methods: [],
};
