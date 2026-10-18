import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-invite-gate',
  group: 'auth',
  importPath: 'components/invite-gate/noizu-invite-gate.js',
  demoHtml: `<noizu-invite-gate brand="therobotplans" email="me@example.com" sign-out-url="/logout" embedded></noizu-invite-gate>`,
  backend: 'external',
  fields: [
    {attr: 'endpoint', type: 'url', default: '/api/v1/invites/redeem', description: 'POST {token}. Same-origin only; off-origin is refused without a request.'},
    {attr: 'continue-url', type: 'string', default: '/app', description: 'Same-origin target after an uncanceled noizu-invite-redeemed.'},
    {attr: 'profile-url', type: 'string', default: '/app/profile', description: 'Profile link. Empty hides it.'},
    {attr: 'settings-url', type: 'string', default: '/app/settings', description: 'Settings link. Empty hides it.'},
    {attr: 'sign-out-url', type: 'string', default: '', description: 'Navigated after an uncanceled noizu-invite-sign-out. Empty = event only.'},
    {attr: 'brand', type: 'string', default: '', description: 'Product name in the explanation.'},
    {attr: 'email', type: 'string', default: '', description: 'Signed-in email shown in the explanation.'},
    {attr: 'token', type: 'string', default: '', description: 'Prefills the code input.'},
    {attr: 'with-credentials', type: 'boolean', default: false, description: 'credentials: "include" on the redeem request (default same-origin).'},
    {attr: 'embedded', type: 'boolean', default: false, description: 'Card only, without the full-page shell.'},
    {attr: 'accessToken', type: 'string', propertyOnly: true, description: 'Bearer token for the redeem request (REST hosts). Never an attribute.'},
  ],
  slots: ['brand', 'footer'],
  events: [
    {name: 'noizu-invite-redeemed', detail: '{result: unknown, continueUrl: string}', description: 'Redeem succeeded. Cancelable; fires before navigation.'},
    {name: 'noizu-invite-error', detail: '{code, status?, message}', description: 'Redeem failed: empty | invalid | expired | used | rate_limited | unauthenticated | failure.'},
    {name: 'noizu-invite-sign-out', detail: '{url: string}', description: 'Sign-out clicked. Cancelable; host clears its session.'},
  ],
  cssVariables: [
    {name: '--auth-accent', default: '#3759bb'},
    {name: '--auth-background', default: '#fff'},
    {name: '--auth-border', default: '#dddfe5'},
    {name: '--auth-error', default: '#a4262c'},
    {name: '--auth-page-background', default: '#f5f6f8'},
  ],
  methods: [
    {name: 'redeem', args: 'token?: string', description: 'Redeem programmatically. Resolves true on success.'},
  ],
};

export const configurators: ConfiguratorSchema[] = [configurator];
