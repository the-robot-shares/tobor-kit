import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'tobor-login-flow',
  group: 'auth',
  importPath: 'components/login-flow/login-flow.js',
  demoHtml: '<tobor-login-flow></tobor-login-flow>',
  backend: 'elixir',
  fields: [
    {
      attr: 'auth',
      type: 'json',
      propertyOnly: true,
      required: true,
      description:
        'GuideAuth block (issuer, client_id, scopes, redirect_path, provider). Never a client secret.',
      placeholder:
        '{"required":true,"provider":"authentik","issuer":"https://auth.example/application/o/app","client_id":"public-client-id","scopes":["openid","email","profile"],"redirect_path":"/auth/oidc/callback"}',
    },
    {
      attr: 'callback-search',
      type: 'string',
      description:
        'Query string treated as the OAuth callback. Defaults to location.search; set "" to skip auto-complete.',
    },
    {
      attr: 'auto-redirect',
      type: 'boolean',
      default: true,
      description: 'location.assign the authorize URL after tobor-auth-redirect.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'tobor-auth-redirect',
      detail: '{url: string}',
      description: 'Authorize URL is ready. Host owns navigation when auto-redirect is false.',
    },
    {
      name: 'tobor-auth-token',
      detail: '{tokens: OAuthTokens}',
      description: 'Public PKCE code exchange succeeded. Host still owns cookies / session.',
    },
    {
      name: 'tobor-auth-error',
      detail: '{error: string}',
      description: 'Login or code exchange failed.',
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
  ],
  methods: [],
};
