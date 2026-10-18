import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-plan-compare',
  group: 'island',
  importPath: 'components/plan-compare/noizu-plan-compare.js',
  demoHtml: `<noizu-plan-compare layout="cards" billing-toggle checkout-url-template="https://example.com/checkout/{planId}">
  <script type="application/json">[{"id":"starter","name":"Starter","priceMonthly":9,"priceYearly":90,"features":["1 seat","Community support"]},{"id":"pro","name":"Pro","priceMonthly":29,"priceYearly":290,"features":["5 seats","Priority support"],"highlighted":true,"ctaLabel":"Go Pro"},{"id":"team","name":"Team","priceMonthly":99,"priceYearly":990,"features":["Unlimited seats","SSO"]}]</script>
</noizu-plan-compare>`,
  backend: 'none',
  fields: [
    {
      attr: 'plans',
      type: 'json',
      propertyOnly: true,
      default: [],
      description:
        'Plan rows {id, name, priceMonthly, priceYearly, features, ctaLabel?, highlighted?}. Not an HTML attribute. Child <script type="application/json"> is used when empty.',
    },
    {
      attr: 'layout',
      type: 'select',
      options: ['cards', 'table'],
      default: 'cards',
      description: 'cards = grid of plan cards; table = feature comparison table.',
    },
    {
      attr: 'billing-toggle',
      type: 'boolean',
      default: false,
      description: 'Show monthly/yearly switch. Displayed price follows the selected interval.',
    },
    {
      attr: 'checkout-url-template',
      type: 'url',
      default: '',
      placeholder: 'https://example.com/checkout/{planId}',
      description: 'Host Payment Link template. `{planId}` is replaced. The island never calls Stripe.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'plan-select',
      detail: "{planId: string, checkoutUrl: string, interval: 'monthly' | 'yearly'}",
      description: 'CTA clicked. Host navigates to checkoutUrl. No in-kit checkout.',
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
    {name: '--tobor-kit-plan-min', default: '16rem'},
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
