/// <reference types="cypress" />
// Isolation lane: noizu-auth in custom-method mode (host-provided sign-in, e.g.
// therobot.institute's Ed25519 key). The element must make no network request at
// all, so fetch and WebSocket are stubbed before the page loads and asserted unused.
const SLOTS = `
  <strong slot="brand">therobot.institute</strong>
  <div slot="method-login" id="login-pane"><p>Sign the challenge with your key.</p><button id="sign-with-key" type="button">sign with key</button></div>
  <div slot="method-register" id="register-pane"><p>Generate a key on this device.</p><button id="make-key" type="button">generate a key</button></div>
`;

function mountCustom() {
  // Auth API paths only (socket default `/auth/*`, REST default `/api/v1/auth/*`) — the
  // element's own module under /dist/components/auth/ must not count as a request.
  cy.intercept({pathname: /^\/(api\/v1\/)?auth\//}, cy.spy().as('authHttp'));
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const nativeFetch = win.fetch.bind(win);
      // Module loading uses the loader, not fetch(), so this counts element traffic only.
      win.fetch = cy.stub().as('fetch').callsFake(nativeFetch);
      win.WebSocket = cy.stub().as('socket').throws(new Error('custom-method mode must not open a socket'));
    },
  });
  return cy.window().then(async (win: any) => {
    await win.mount('noizu-auth', {mode: 'modal', 'custom-method': ''}, {text: {loginTitle: 'sign in with your key', signupTitle: 'join the institute'}}, SLOTS);
    win.__events.length = 0;
  });
}

const auth = () => cy.get('noizu-auth');
const shadow = (selector: string) => auth().shadow().find(selector);
const events = () => cy.window().then((win: any) => win.__events.map((e: {type: string}) => e.type));

describe('Given noizu-auth in custom-method mode, when a host drives its own sign-in, then the kit supplies only chrome and never touches the network', () => {
  beforeEach(mountCustom);

  it('Given a closed modal, when the host opens it, then the dialog shows the host login pane and no built-in pipe UI', () => {
    auth().then(($el) => {($el[0] as any).open = true;});
    shadow('dialog').should('have.prop', 'open', true);
    shadow('[data-cy="auth-title"]').should('have.text', 'sign in with your key');
    cy.get('#sign-with-key').should('be.visible');
    cy.get('#make-key').should('not.be.visible');
    shadow('[data-cy="email-input"]').should('not.exist');
    shadow('form').should('not.exist');
    shadow('[part~="providers"]').should('not.exist');
    auth().find('noizu-human-verify').should('not.exist');
    shadow('noizu-human-verify').should('not.exist');
    cy.focused().should('have.id', 'sign-with-key');
    cy.screenshot('auth-custom-method-login');
  });

  it('Given the modal is open, when time passes, then no fetch, socket or auth HTTP call was made', () => {
    auth().then(($el) => {($el[0] as any).open = true;});
    shadow('dialog').should('have.prop', 'open', true);
    cy.wait(500);
    cy.get('@fetch').should('not.have.been.called');
    cy.get('@socket').should('not.have.been.called');
    cy.get('@authHttp').should('not.have.been.called');
  });

  it('Given the login pane, when flow switches to signup, then the register pane renders', () => {
    auth().then(($el) => {($el[0] as any).flow = 'signup';});
    shadow('[data-cy="auth-title"]').should('have.text', 'join the institute');
    auth().then(($el) => {($el[0] as any).open = true;});
    cy.get('#make-key').should('be.visible');
    cy.get('#sign-with-key').should('not.be.visible');
  });

  it('Given slotted content, when it dispatches auth-flow-switch, then the element switches flow', () => {
    auth().then(($el) => {($el[0] as any).open = true;});
    cy.get('#sign-with-key').then(($btn) => {
      $btn[0].dispatchEvent(new CustomEvent('auth-flow-switch', {detail: {flow: 'register'}, bubbles: true, composed: true}));
    });
    auth().should('have.attr', 'flow', 'signup');
    cy.get('#make-key').should('be.visible');
    events().should('include', 'noizu-auth-flow-change');
  });

  it('Given the modal is open, when the host calls complete(), then auth-success carries its detail and the dialog closes', () => {
    auth().then(($el) => {($el[0] as any).open = true;});
    shadow('dialog').should('have.prop', 'open', true);
    auth().then(($el) => {($el[0] as any).complete({entityId: 'e-1', publicKey: 'ed25519:abc'});});
    shadow('dialog').should('have.prop', 'open', false);
    cy.window().then((win: any) => {
      const success = win.__events.find((e: {type: string}) => e.type === 'auth-success');
      expect(success.detail).to.deep.equal({entityId: 'e-1', publicKey: 'ed25519:abc'});
    });
    events().should('include', 'auth-close');
  });

  it('Given the modal is open, when the visitor presses Escape, then auth-close fires and the dialog closes', () => {
    auth().then(($el) => {($el[0] as any).open = true;});
    shadow('dialog').should('have.prop', 'open', true);
    // A real key press through CDP: a synthetic keydown never reaches the native dialog's cancel path.
    cy.focused().should('have.id', 'sign-with-key');
    // Queued with cy.then so the key is sent after the dialog has opened, not at spec-build time.
    for (const type of ['keyDown', 'keyUp']) {
      cy.then(() => Cypress.automation('remote:debugger:protocol', {command: 'Input.dispatchKeyEvent', params: {type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27}}));
    }
    shadow('dialog').should('have.prop', 'open', false);
    events().should('include', 'auth-close');
    auth().should('not.have.attr', 'open');
  });
});
