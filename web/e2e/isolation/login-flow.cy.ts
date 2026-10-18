/// <reference types="cypress" />
// Isolation lane: tobor-login-flow (OIDC code + PKCE) on the blank harness
// page. The token exchange is cy.intercept-mocked; sign-in redirect is run
// with autoRedirect:false so no navigation ever happens.
const AUTH = {
  required: true,
  provider: 'authentik' as const,
  issuer: 'https://id.example.com/',
  client_id: 'tobor-kit-test',
  scopes: ['openid', 'email', 'profile'],
  redirect_path: '/auth/oidc/callback',
};
const events = () => cy.window().then((win: any) => win.__events);

function mount(props: Record<string, unknown>) {
  cy.visit('/e2e/isolation/harness.html');
  return cy.window().then(async (win: any) => {
    await win.mount('tobor-login-flow', {}, {auth: AUTH, autoRedirect: false, ...props});
    win.__events.length = 0;
  });
}

describe('Given an OIDC projection auth block, when the login flow runs on the isolation harness, then PKCE redirects, callback exchange and error paths emit real events', () => {
  it('Given a signed-out visitor, when Sign in is clicked, then tobor-auth-redirect fires with an authorize URL and the PKCE verifier is stashed', () => {
    mount({});
    cy.get('tobor-login-flow').shadow().find('[data-testid="login-button"]').should('contain.text', 'Sign in');
    cy.screenshot('login-flow-signed-out');

    cy.get('tobor-login-flow').shadow().find('[data-testid="login-button"]').click();
    events().then((evts: any[]) => {
      const redirect = evts.find((e) => e.type === 'tobor-auth-redirect');
      expect(redirect, 'tobor-auth-redirect emitted').to.exist;
      const url = new URL(redirect.detail.url);
      expect(url.pathname).to.eq('/authorize');
      expect(url.searchParams.get('client_id')).to.eq('tobor-kit-test');
      expect(url.searchParams.get('response_type')).to.eq('code');
      expect(url.searchParams.get('code_challenge_method')).to.eq('S256');
      // Trailing-slash issuer quirk: no double slash before /authorize.
      expect(redirect.detail.url).to.not.contain('//authorize');
    });
    cy.window().then((win: any) => {
      expect(win.sessionStorage.getItem('tobor-kit:pkce:state'), 'state stashed').to.exist;
      expect(win.sessionStorage.getItem('tobor-kit:pkce:verifier'), 'verifier stashed').to.exist;
    });
    cy.location('pathname').should('eq', '/e2e/isolation/harness.html');
    cy.screenshot('login-flow-redirect-emitted');
  });

  it('Given a callback query with a stashed verifier, when the element mounts, then the mocked token exchange signs the user in and emits tobor-auth-token', () => {
    cy.intercept('POST', 'https://id.example.com/token', {
      statusCode: 200,
      body: {access_token: 'at-123', token_type: 'Bearer', id_token: 'id-123', expires_in: 3600},
    }).as('tokenExchange');
    cy.visit('/e2e/isolation/harness.html');

    cy.window().then(async (win: any) => {
      win.sessionStorage.setItem('tobor-kit:pkce:state', 'st-state');
      win.sessionStorage.setItem('tobor-kit:pkce:verifier', 'st-verifier');
      await win.mount('tobor-login-flow', {}, {
        auth: AUTH,
        autoRedirect: false,
        callbackSearch: '?code=auth-code&state=st-state',
      });
      win.__events.length = 0;
    });
    cy.wait('@tokenExchange').then((interception) => {
      const body = new URLSearchParams(String(interception.request.body));
      expect(body.get('grant_type')).to.eq('authorization_code');
      expect(body.get('code')).to.eq('auth-code');
      expect(body.get('code_verifier')).to.eq('st-verifier');
    });
    cy.get('tobor-login-flow').shadow().find('[data-testid="login-user"]').should('have.text', 'Signed in');
    events().then((evts: any[]) => {
      const token = evts.find((e) => e.type === 'tobor-auth-token');
      expect(token, 'tobor-auth-token emitted').to.exist;
      expect(token.detail.tokens.access_token).to.eq('at-123');
    });
    cy.screenshot('login-flow-signed-in');
  });

  it('Given a callback whose state does not match, when the element mounts, then the exchange is refused and tobor-auth-error fires', () => {
    cy.visit('/e2e/isolation/harness.html');

    // Capture via a window listener — the element's async completion races
    // the harness __events reset, and bubbling composed events land here.
    cy.window().then((win: any) => {
      win.__authError = null;
      win.addEventListener('tobor-auth-error', (e: CustomEvent) => {
        win.__authError = e.detail.error;
      });
    });
    cy.window().then(async (win: any) => {
      win.sessionStorage.setItem('tobor-kit:pkce:state', 'real-state');
      win.sessionStorage.setItem('tobor-kit:pkce:verifier', 'st-verifier');
      await win.mount('tobor-login-flow', {}, {
        auth: AUTH,
        autoRedirect: false,
        callbackSearch: '?code=evil-code&state=forged-state',
      });
    });
    cy.get('tobor-login-flow').shadow().find('[data-testid="login-error"]').should('contain', 'state mismatch');
    cy.window().then((win: any) => {
      expect(win.__authError, 'tobor-auth-error emitted').to.contain('state mismatch');
    });
    cy.screenshot('login-flow-state-mismatch');
  });
});
