/// <reference types="cypress" />
// Isolation lane: noizu-auth mounted on the blank harness page.
// The element only opens its WebSocket transport on user submit, so the
// render/flow/modal surfaces below are fully backend-free.
// Default copy of the console layout (the default since 0.1.5, PR #65); see
// DEFAULT_TEXT in src/components/auth/noizu-auth.ts. Flow switching goes through
// the console-foot links, addressed by their data-cy hooks, not their wording.
const LOGIN_TITLE = 'log in';
const SIGNUP_TITLE = 'sign up';
const CONTINUE = 'continue';

const events = () => cy.window().then((win: any) => win.__events);

function mount(attrs: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  return cy.window().then(async (win: any) => {
    await win.mount('noizu-auth', attrs, props);
    win.__events.length = 0;
  });
}

describe('Given the noizu-auth sign-in card, when a user works the flows on the isolation harness, then rendering, flow switching and modal close behave with real events', () => {
  it('Given the default interstitial login, when the card renders, then title, email/password fields and submit are present', () => {
    mount();
    cy.get('noizu-auth').shadow().find('[data-cy="auth-card"]').should('be.visible');
    cy.get('noizu-auth').shadow().find('[data-cy="auth-title"]').should('have.text', LOGIN_TITLE);
    cy.get('noizu-auth').shadow().find('[data-cy="email-input"]').should('exist');
    // First step is email-only: the transport is only opened on submit.
    cy.get('noizu-auth').shadow().find('[data-cy="password-input"]').should('not.exist');
    cy.get('noizu-auth').shadow().find('[data-cy="submit-login"]').should('have.text', CONTINUE);
    cy.screenshot('auth-login-card');
  });

  it('Given the login card, when the signup toggle is clicked, then the form switches to signup fields and back', () => {
    mount();
    cy.get('noizu-auth').shadow().find('[data-cy="signup-link"]').should('have.text', 'get started').click();
    cy.get('noizu-auth').shadow().find('[data-cy="auth-title"]').should('have.text', SIGNUP_TITLE);
    // Signup also starts on the email step; the password flow comes after.
    cy.get('noizu-auth').shadow().find('[data-cy="email-input"]').should('exist');
    cy.get('noizu-auth').shadow().find('[data-cy="submit-signup"]').should('have.text', CONTINUE);
    cy.screenshot('auth-signup-card');

    cy.get('noizu-auth').shadow().find('.console-foot').should('contain.text', 'already have an account?');
    cy.get('noizu-auth').shadow().find('[data-cy="login-link"]').should('have.text', 'log in').click();
    cy.get('noizu-auth').shadow().find('[data-cy="auth-title"]').should('have.text', LOGIN_TITLE);
    cy.screenshot('auth-back-to-login');
  });

  it('Given modal mode, when the card is opened and closed, then a real dialog shows and auth-close is emitted', () => {
    mount({mode: 'modal'}, {open: true});
    cy.get('noizu-auth').shadow().find('dialog').should('have.attr', 'open');
    cy.get('noizu-auth').shadow().find('[data-cy="auth-title"]').should('have.text', LOGIN_TITLE);
    cy.screenshot('auth-modal-open');

    cy.get('noizu-auth').shadow().find('.auth-close').click();
    cy.get('noizu-auth').should('not.have.attr', 'open');
    events().then((evts: any[]) => {
      expect(evts.some((e) => e.type === 'auth-close'), 'auth-close emitted').to.be.true;
    });
    cy.screenshot('auth-modal-closed');
  });

  // The invite-rejection → fallback-navigation behaviour itself is covered in the unit
  // lane (src/components/auth/test/unit/auth.test.ts) via the component's navigateTo()
  // seam — the built dist bundle calls the unforgeable window.location.assign, which
  // Cypress cannot intercept. Here we pin the additive-attribute contract: mounting with
  // invite-fallback-url changes nothing about the backend-free render.
  it('Given the invite-fallback-url attribute, when the card mounts, then it renders unchanged and reflects the attribute', () => {
    mount({'invite-token-mode': 'required', 'invite-fallback-url': '/waitlist'});
    cy.get('noizu-auth').should('have.attr', 'invite-fallback-url', '/waitlist');
    cy.get('noizu-auth').shadow().find('[data-cy="auth-card"]').should('be.visible');
    cy.get('noizu-auth').shadow().find('[data-cy="auth-title"]').should('have.text', LOGIN_TITLE);
    cy.get('noizu-auth').shadow().find('[data-cy="auth-error"]').should('have.text', '');
    cy.screenshot('auth-invite-fallback-attribute');
  });
});
