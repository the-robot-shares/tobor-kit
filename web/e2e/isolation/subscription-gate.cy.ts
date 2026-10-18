/// <reference types="cypress" />
// Isolation lane: noizu-subscription-gate on the blank harness page.
// Entitlement check-url fetch is cy.intercept-mocked; the host owns truth.
function visit() {
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const s = win.document.createElement('script');
      s.type = 'module';
      s.textContent =
        "import '/dist/components/subscription-gate/noizu-subscription-gate.js';window.__modulesReady = true;";
      win.document.head.appendChild(s);
    },
  });
  cy.window().should('have.prop', '__modulesReady', true);
}

function mount(attrs: Record<string, string> = {}, slotsHTML = '') {
  return cy.window().then(async (win: any) => {
    await win.customElements.whenDefined('noizu-subscription-gate');
    win.unmount();
    win.__events.length = 0;
    const el = win.document.createElement('noizu-subscription-gate');
    const native = el.dispatchEvent.bind(el);
    el.dispatchEvent = (event: CustomEvent) => {
      if (event instanceof win.CustomEvent) {
        win.__events.push({type: event.type, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null});
      }
      return native(event);
    };
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    const tpl = win.document.createElement('template');
    tpl.innerHTML = slotsHTML;
    while (tpl.content.firstChild) el.appendChild(tpl.content.firstChild);
    win.document.getElementById('mount-root').appendChild(el);
    return el;
  });
}

const events = () => cy.window().then((win: any) => win.__events);

describe('Given a host-owned entitlement gate, when mounted on the isolation harness, then slot content, blocked state and check-url behave', () => {
  it('Given entitled=true, when mounted with slotted content, then the content shows and no gate blocks it', () => {
    visit();
    mount({entitled: ''}, '<p data-cy="slot-content">Premium subscriber body</p>');
    cy.get('noizu-subscription-gate [data-cy="slot-content"]').should('contain.text', 'Premium subscriber body');
    cy.get('noizu-subscription-gate').shadow().find('[data-cy="gate.blocked"]').should('not.exist');
    events().then((evts: any[]) => expect(evts.filter((e) => e.type === 'gate-blocked'), 'no blocked event').to.have.length(0));
    cy.screenshot('subscription-gate-entitled');
  });

  it('Given no entitlement and no check-url, when mounted, then the blocked panel renders and gate-blocked names the default redirect', () => {
    visit();
    mount({}, '<p>Hidden body</p>');
    cy.get('noizu-subscription-gate').shadow().find('[data-cy="gate.blocked"]').should('contain', 'requires a subscription');
    cy.get('noizu-subscription-gate').shadow().find('[data-cy="gate.link"]').should('have.attr', 'href', '/pricing');
    events().then((evts: any[]) => {
      const blocked = evts.filter((e) => e.type === 'gate-blocked');
      expect(blocked.length, 'gate-blocked emitted').to.eq(1);
      expect(blocked[0].detail).to.deep.eq({redirectTo: '/pricing'});
    });
    cy.screenshot('subscription-gate-blocked-default');
  });

  it('Given a custom redirect-to, when blocked, then the upgrade link and event carry the custom path', () => {
    visit();
    mount({'redirect-to': '/upgrade/now'});
    cy.get('noizu-subscription-gate').shadow().find('[data-cy="gate.link"]').should('have.attr', 'href', '/upgrade/now');
    events().then((evts: any[]) => {
      expect(evts.find((e) => e.type === 'gate-blocked').detail).to.deep.eq({redirectTo: '/upgrade/now'});
    });
    cy.screenshot('subscription-gate-blocked-custom-redirect');
  });

  it('Given a check-url that answers entitled, when the fetch resolves, then the gate opens without emitting gate-blocked', () => {
    cy.intercept('GET', '/api/entitlement', {statusCode: 200, body: {entitled: true}}).as('entitlement');
    visit();
    mount({'check-url': '/api/entitlement'}, '<p data-cy="slot-content">Unlocked after check</p>');
    cy.wait('@entitlement');
    cy.get('noizu-subscription-gate [data-cy="slot-content"]').should('contain.text', 'Unlocked after check');
    cy.get('noizu-subscription-gate').shadow().find('[data-cy="gate.blocked"]').should('not.exist');
    events().then((evts: any[]) => expect(evts.filter((e) => e.type === 'gate-blocked')).to.have.length(0));
    cy.screenshot('subscription-gate-check-url-entitled');
  });

  it('Given a check-url that answers not entitled, when the fetch resolves, then the blocked panel stays and gate-blocked fires once', () => {
    cy.intercept('GET', '/api/entitlement', {statusCode: 200, body: {entitled: false}}).as('entitlement');
    visit();
    mount({'check-url': '/api/entitlement'});
    cy.wait('@entitlement');
    cy.get('noizu-subscription-gate').shadow().find('[data-cy="gate.blocked"]').should('be.visible');
    events().then((evts: any[]) => expect(evts.filter((e) => e.type === 'gate-blocked'), 'exactly one blocked event').to.have.length(1));
    cy.screenshot('subscription-gate-check-url-denied');
  });
});
