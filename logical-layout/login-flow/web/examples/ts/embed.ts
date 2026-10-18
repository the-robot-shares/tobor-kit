// Host apps: import '@noizu/tobor-kit/login-flow.js' (+ types from '@noizu/tobor-kit').
import '../../login-flow.js';
import type {GuideAuth} from '../../../../types.js';
import {
  beginLogin,
  completeLogin,
  type OAuthTokens,
  type ToborLoginFlow,
} from '../../login-flow.js';

/** Public config from GET /api/tobor-kit/guide → auth. Never a client secret. */
const auth: GuideAuth = {
  required: true,
  provider: 'authentik',
  issuer: 'https://auth.example/application/o/your-app',
  client_id: 'public-client-id',
  scopes: ['openid', 'email', 'profile'],
  redirect_path: '/auth/oidc/callback',
};

const el =
  (document.querySelector('tobor-login-flow') as ToborLoginFlow | null) ??
  document.createElement('tobor-login-flow');
el.auth = auth;
el.autoRedirect = true;
if (!el.isConnected) document.body.append(el);

el.addEventListener('tobor-auth-redirect', (event: Event) => {
  const {url} = (event as CustomEvent<{url: string}>).detail;
  void url;
});

el.addEventListener('tobor-auth-token', async (event: Event) => {
  const {tokens} = (event as CustomEvent<{tokens: OAuthTokens}>).detail;
  await persistHostSession(tokens);
});

el.addEventListener('tobor-auth-error', (event: Event) => {
  const {error} = (event as CustomEvent<{error: string}>).detail;
  console.error(error);
});

/** Host-owned cookie mint — verify id_token server-side (JWKS). */
async function persistHostSession(tokens: OAuthTokens): Promise<void> {
  const res = await fetch('/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({id_token: tokens.id_token}),
  });
  if (!res.ok) throw new Error(`session mint failed (${res.status})`);
}

/** Same flow without the element (helpers exported from the module). */
export async function loginWithoutElement(): Promise<void> {
  const redirect = await beginLogin(auth);
  if (!redirect) return;
  globalThis.location.assign(redirect.url);
}

export async function completeWithoutElement(search = globalThis.location.search): Promise<void> {
  const tokens = await completeLogin(auth, search);
  await persistHostSession(tokens);
}
