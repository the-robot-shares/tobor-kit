import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-subscription-gate',
  group: 'island',
  importPath: 'components/subscription-gate/noizu-subscription-gate.js',
  demoHtml: `<noizu-subscription-gate entitled redirect-to="/pricing">
  <p>Subscriber content</p>
</noizu-subscription-gate>`,
  backend: 'none',
  fields: [
    {
      attr: 'entitled',
      type: 'boolean',
      default: false,
      description: 'Host-owned entitlement. Default slot renders only when true.',
    },
    {
      attr: 'check-url',
      type: 'url',
      placeholder: '/entitlement',
      description: 'Optional GET. 200 + {entitled:true} sets entitled. Host still owns truth.',
    },
    {
      attr: 'redirect-to',
      type: 'string',
      default: '/pricing',
      description: 'Blocked link href and gate-blocked.redirectTo. Empty falls back to /pricing.',
    },
    {
      attr: 'auto-redirect',
      type: 'boolean',
      default: false,
      description:
        'If true, location.assign(redirectTo) after gate-blocked unless the event is canceled.',
    },
  ],
  slots: ['default'],
  events: [
    {
      name: 'gate-blocked',
      detail: '{redirectTo: string}',
      description:
        'Not entitled (after optional check-url). Cancelable. Fired before any navigation.',
    },
  ],
  cssVariables: [
    {name: '--tobor-kit-fg', default: '#e8e9f0'},
    {name: '--tobor-kit-accent', default: '#6ee7c7'},
    {name: '--tobor-kit-border', default: '#2c2f3d'},
    {name: '--tobor-kit-radius', default: '12px'},
    {name: '--tobor-kit-gap', default: '12px'},
  ],
  methods: [
    {
      name: 'navigate',
      args: 'href: string',
      description:
        'location.assign used after an uncanceled gate-blocked when auto-redirect is true. Override to intercept.',
    },
  ],
};

export const configurators: ConfiguratorSchema[] = [configurator];
