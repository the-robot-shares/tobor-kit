import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-billing-status',
  group: 'island',
  importPath: 'components/billing-status/noizu-billing-status.js',
  demoHtml: '<noizu-billing-status></noizu-billing-status>',
  backend: 'none',
  fields: [
    {
      attr: 'subscription',
      type: 'json',
      propertyOnly: true,
      description:
        'Host-owned snapshot {status, trialEndsAt?, renewsAt?, complimentary?, planName?}. Never a Stripe object or secret.',
      placeholder:
        '{"status":"active","planName":"Pro","renewsAt":"2026-10-01"}',
    },
  ],
  slots: [],
  events: [
    {
      name: 'portal-open',
      detail: '{}',
      description:
        'Manage billing clicked. Host opens the Stripe customer portal. The element never talks to Stripe.',
    },
  ],
  cssVariables: [
    {name: '--tobor-kit-fg', default: '#e8e9f0'},
    {name: '--tobor-kit-muted', default: '#9aa0b4'},
    {name: '--tobor-kit-accent', default: '#6ee7c7'},
    {name: '--tobor-kit-accent-fg', default: '#08130f'},
    {name: '--tobor-kit-border', default: '#2c2f3d'},
    {name: '--tobor-kit-danger', default: '#ff6b6b'},
    {name: '--tobor-kit-warn', default: '#f5c451'},
    {name: '--tobor-kit-radius', default: '12px'},
    {name: '--tobor-kit-gap', default: '12px'},
    {name: '--tobor-kit-font-family', default: 'system-ui, -apple-system, "Segoe UI", sans-serif'},
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
