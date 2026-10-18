import '@noizu/tobor-kit/login-flow.js';

/** Public GuideAuth from GET /api/tobor-kit/guide → auth. Never a client secret. */
const auth = {
  required: true,
  provider: 'authentik',
  issuer: 'https://auth.example/application/o/your-app',
  client_id: 'public-client-id',
  scopes: ['openid', 'email', 'profile'],
  redirect_path: '/auth/oidc/callback',
};

const el = document.querySelector('tobor-login-flow') ?? document.createElement('tobor-login-flow');
el.auth = auth;
// Host owns navigation: el.autoRedirect = false;
// Host-owned callback page: el.callbackSearch = '';
if (!el.isConnected) document.body.append(el);

el.addEventListener('tobor-auth-redirect', (event) => {
  // Fired before location.assign when auto-redirect is true.
  void event.detail.url;
});

el.addEventListener('tobor-auth-token', async (event) => {
  // Host owns the session cookie. Element never Set-Cookie.
  const res = await fetch('/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({id_token: event.detail.tokens.id_token}),
  });
  if (!res.ok) throw new Error(`session mint failed (${res.status})`);
});

el.addEventListener('tobor-auth-error', (event) => {
  console.error(event.detail.error);
});
