import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-human-verify',
  group: 'island',
  importPath: 'components/human-verify/noizu-human-verify.js',
  demoHtml: '<noizu-human-verify provider="none" action="signup"></noizu-human-verify>',
  backend: 'external',
  fields: [
    {
      attr: 'provider',
      type: 'select',
      options: ['none', 'turnstile', 'recaptcha-v3'],
      default: 'none',
      description:
        'Challenge provider. none emits verified on connect (host opted out). Unknown values clamp to none.',
    },
    {
      attr: 'site-key',
      type: 'string',
      default: '',
      placeholder: 'public site key',
      description: 'PUBLIC site key only. Never a secret. Required for turnstile and recaptcha-v3.',
    },
    {
      attr: 'action',
      type: 'string',
      default: 'signup',
      description: 'Passed to Turnstile / reCAPTCHA v3 execute. Empty falls back to signup.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'verified',
      detail: '{provider: "turnstile" | "recaptcha-v3" | "none", token: string}',
      description:
        'Challenge completed (or host opted out). NOT proof — host MUST POST token to siteverify.',
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
  ],
  methods: [
    {
      name: 'reset',
      args: '',
      description:
        'Re-run the provider. none re-emits verified; turnstile resets the widget; recaptcha-v3 executes again.',
    },
  ],
};

export const configurators: ConfiguratorSchema[] = [configurator];
