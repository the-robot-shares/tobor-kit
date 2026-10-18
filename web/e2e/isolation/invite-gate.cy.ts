/// <reference types="cypress" />
// Isolation lane: the invite interstitial ("register open, app gated").
// <noizu-auth invite-token-mode="optional"> on the REST transport routes a held signup to
// the interstitial, and <noizu-invite-gate> redeems a code. Every backend call is
// cy.intercept-mocked; navigation targets are harness URLs so the lane stays on one page.
const HARNESS = '/e2e/isolation/harness.html';
const events = () => cy.window().then((win: any) => win.__events);
const auth = (selector: string) => cy.get('noizu-auth').shadow().find(selector);
const gate = (selector: string) => cy.get('noizu-invite-gate').shadow().find(selector);

function mount(tag: string, attrs: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  cy.visit(HARNESS);
  return cy.window().then(async (win: any) => {
    await win.mount(tag, attrs, props);
    win.__events.length = 0;
  });
}

function fillSignup(invite = '') {
  auth('[data-cy="email-input"]').type('held@example.test');
  auth('[data-cy="user_name-input"]').type('held');
  auth('[data-cy="first_name-input"]').type('Held');
  auth('[data-cy="last_name-input"]').type('User');
  auth('[data-cy="password-input"]').type('secret-pass-1');
  if (invite) auth('[data-cy="invite_token-input"]').type(invite);
}

describe('Given the invite interstitial, when a held account signs up and redeems, then the optional field, routing and redeem states behave', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/v1/auth/config', {statusCode: 200, body: {}});
  });

  it('Given invite-token-mode="optional", when the signup card renders, then the invite field is optional with the add-it-later hint', () => {
    mount('noizu-auth', {flow: 'signup', transport: 'rest', 'invite-token-mode': 'optional'}, {pipes: ['email_password']});
    auth('[data-cy="invite_token-input"]').should('not.have.attr', 'required');
    auth('[data-cy="invite-token-hint"]').should('contain.text', 'otherwise you can add it after signing up');
    auth('[data-cy="invite_token-input"]').should('have.attr', 'aria-describedby', 'invite_token-hint');
    cy.screenshot('invite-gate-optional-field');
  });

  it('Given a held signup (user.invite_required), when the user signs up without a code, then the session is handed over and the browser lands on the interstitial', () => {
    cy.intercept('POST', '/api/v1/auth/register', {
      statusCode: 201,
      body: {access_token: 'held-token', user: {email: 'held@example.test', status: 'pending', invite_required: true}},
    }).as('register');
    mount('noizu-auth', {flow: 'signup', transport: 'rest', 'invite-token-mode': 'optional', 'invite-required-url': `${HARNESS}?held=1`}, {pipes: ['email_password']});
    cy.window().then((win: any) => {
      const el = win.document.querySelector('noizu-auth');
      // Persist across the navigation: the host would store the Bearer token here.
      el.addEventListener('auth-success', (e: CustomEvent) => win.sessionStorage.setItem('held-session', e.detail.session.accessToken));
    });
    fillSignup();
    auth('[data-cy="pipe-submit"]').click();
    cy.wait('@register').its('request.body').should((body: any) => expect(body.invite_token, 'no code sent').to.be.undefined);
    cy.location('search').should('eq', '?held=1');
    cy.window().then((win: any) => expect(win.sessionStorage.getItem('held-session')).to.eq('held-token'));
  });

  it('Given a backend that refuses register with the invite_required code, when the user signs up, then no error block renders and the event routes to the interstitial', () => {
    cy.intercept('POST', '/api/v1/auth/register', {statusCode: 403, body: {error: 'invite_required', message: 'An invite code is required'}}).as('register');
    mount('noizu-auth', {flow: 'signup', transport: 'rest', 'invite-token-mode': 'optional'}, {pipes: ['email_password']});
    cy.window().then((win: any) => win.document.querySelector('noizu-auth').addEventListener('noizu-auth-invite-required', (e: Event) => e.preventDefault()));
    fillSignup();
    auth('[data-cy="pipe-submit"]').click();
    cy.wait('@register');
    auth('[data-cy="auth-error"]').should('have.text', '');
    events().then((evts: any[]) => {
      const routed = evts.find((e) => e.type === 'noizu-auth-invite-required');
      expect(routed, 'noizu-auth-invite-required').to.exist;
      expect(routed.detail).to.deep.eq({url: '/auth/invite-required', source: 'register-error'});
      expect(evts.some((e) => e.type === 'auth-error'), 'no auth-error').to.be.false;
    });
    cy.screenshot('invite-gate-routed-not-errored');
  });

  it('Given the interstitial, when a valid code is redeemed, then the request carries it and the browser continues', () => {
    cy.intercept('POST', '/api/v1/invites/redeem', {statusCode: 200, body: {organization_id: 'org-1', role: 'member', invite_required: false}}).as('redeem');
    mount('noizu-invite-gate', {brand: 'therobotplans', email: 'held@example.test', 'continue-url': `${HARNESS}?continued=1`}, {accessToken: 'held-token'});
    gate('[data-cy="invite-description"]').should('contain.text', 'therobotplans is invite-only');
    cy.screenshot('invite-gate-card');
    gate('[data-cy="invite-code-input"]').should('be.focused').type('GOOD-INVITE');
    gate('[data-cy="invite-redeem-submit"]').click();
    cy.wait('@redeem').then(({request}) => {
      expect(request.body).to.deep.eq({token: 'GOOD-INVITE'});
      expect(request.headers.authorization).to.eq('Bearer held-token');
    });
    cy.location('search').should('eq', '?continued=1');
  });

  const failures: [string, number, unknown, string, string][] = [
    ['an unknown code', 404, {error: 'Invalid or expired invite token'}, 'invalid', 'invalid or expired'],
    ['a used invite', 409, {error: 'This invite has already been used'}, 'used', 'already been used'],
    ['too many attempts', 429, {}, 'rate_limited', 'too many attempts'],
  ];
  for (const [name, statusCode, body, code, copy] of failures) {
    it(`Given the interstitial, when ${name} is redeemed, then the ${code} alert is announced and focus returns to the input`, () => {
      cy.intercept('POST', '/api/v1/invites/redeem', {statusCode, body}).as('redeem');
      mount('noizu-invite-gate', {brand: 'therobotplans'});
      gate('[data-cy="invite-code-input"]').type('BAD-CODE');
      gate('[data-cy="invite-redeem-submit"]').click();
      cy.wait('@redeem');
      gate('[data-cy="invite-error"]').should('be.visible').and('have.attr', 'role', 'alert').and('have.attr', 'data-code', code).and('contain.text', copy);
      gate('[data-cy="invite-code-input"]').should('be.focused').and('have.attr', 'aria-invalid', 'true');
      cy.location('pathname').should('eq', HARNESS);
      events().then((evts: any[]) => {
        const failed = evts.find((e) => e.type === 'noizu-invite-error');
        expect(failed, 'noizu-invite-error emitted').to.exist;
        expect(failed.detail.code).to.eq(code);
      });
      cy.screenshot(`invite-gate-error-${code}`);
    });
  }

  it('Given the interstitial, when sign out is clicked, then noizu-invite-sign-out fires with the configured URL', () => {
    mount('noizu-invite-gate', {'sign-out-url': '/logout'});
    cy.window().then((win: any) => win.document.querySelector('noizu-invite-gate').addEventListener('noizu-invite-sign-out', (e: Event) => e.preventDefault()));
    gate('[data-cy="invite-sign-out"]').click();
    events().then((evts: any[]) => {
      const out = evts.find((e) => e.type === 'noizu-invite-sign-out');
      expect(out, 'noizu-invite-sign-out emitted').to.exist;
      expect(out.detail).to.deep.eq({url: '/logout'});
    });
    gate('[data-cy="invite-profile-link"]').should('have.attr', 'href', '/app/profile');
    gate('[data-cy="invite-settings-link"]').should('have.attr', 'href', '/app/settings');
  });
});
