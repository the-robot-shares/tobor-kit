/// <reference types="cypress" />
// Isolation lane: noizu-billing-status on the blank harness page.
// The subscription snapshot is a host-owned JS property; no backend exists.
function visit() {
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const s = win.document.createElement('script');
      s.type = 'module';
      s.textContent =
        "import '/dist/components/billing-status/noizu-billing-status.js';window.__modulesReady = true;";
      win.document.head.appendChild(s);
    },
  });
  cy.window().should('have.prop', '__modulesReady', true);
}

function mount(subscription?: unknown) {
  return cy.window().then(async (win: any) => {
    await win.customElements.whenDefined('noizu-billing-status');
    win.unmount();
    win.__events.length = 0;
    const el = win.document.createElement('noizu-billing-status');
    const native = el.dispatchEvent.bind(el);
    el.dispatchEvent = (event: CustomEvent) => {
      if (event instanceof win.CustomEvent) {
        win.__events.push({type: event.type, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null});
      }
      return native(event);
    };
    if (subscription !== undefined) el.subscription = subscription;
    win.document.getElementById('mount-root').appendChild(el);
    return el;
  });
}

const events = () => cy.window().then((win: any) => win.__events);

describe('Given a host-supplied subscription snapshot, when mounted on the isolation harness, then the status row reflects it and portal-open is host-owned', () => {
  it('Given an active paid plan, when mounted, then status, plan name and renewal date render with data-kind=active', () => {
    visit();
    mount({status: 'active', planName: 'Pro', renewsAt: '2026-10-01T00:00:00Z'});
    cy.get('noizu-billing-status').shadow().find('[data-cy="billing.status"]').should('contain.text', 'Active').and('have.attr', 'data-kind', 'active');
    cy.get('noizu-billing-status').shadow().find('[data-cy="billing.plan"]').should('contain.text', 'Pro');
    cy.get('noizu-billing-status').shadow().find('[part="dates"]').should('contain', 'Renews 2026-10-01');
    cy.screenshot('billing-status-active');
  });

  it('Given trialing and past_due snapshots, when swapped in, then labels, dates and data-kind track the status', () => {
    visit();
    mount({status: 'trialing', planName: 'Starter', trialEndsAt: '2026-12-01T12:00:00Z'});
    cy.get('noizu-billing-status').shadow().find('[data-cy="billing.status"]').should('contain.text', 'Trialing').and('have.attr', 'data-kind', 'trialing');
    cy.get('noizu-billing-status').shadow().find('[part="dates"]').should('contain', 'Trial ends 2026-12-01');
    cy.screenshot('billing-status-trialing');
    cy.window().then((win: any) => {
      win.document.querySelector('noizu-billing-status').subscription = {status: 'past_due', planName: 'Pro'};
    });
    cy.get('noizu-billing-status').shadow().find('[data-cy="billing.status"]').should('contain.text', 'Past due').and('have.attr', 'data-kind', 'past_due');
    cy.screenshot('billing-status-past-due');
  });

  it('Given a complimentary flag, when set on any status, then the row reports Complimentary', () => {
    visit();
    mount({status: 'active', complimentary: true, planName: 'Internal'});
    cy.get('noizu-billing-status').shadow().find('[data-cy="billing.status"]').should('contain.text', 'Complimentary').and('have.attr', 'data-kind', 'complimentary');
    cy.screenshot('billing-status-complimentary');
  });

  it('Given no snapshot and then a portal click, when Manage billing is pressed, then the empty state shows and portal-open fires for the host', () => {
    visit();
    mount();
    cy.get('noizu-billing-status').shadow().find('[data-cy="billing.status"]').should('contain.text', 'No subscription');
    cy.get('noizu-billing-status').shadow().find('[data-cy="billing.plan"]').should('not.exist');
    cy.screenshot('billing-status-empty');
    cy.get('noizu-billing-status').shadow().find('[data-cy="billing.portal"]').click();
    events().then((evts: any[]) => {
      const opens = evts.filter((e) => e.type === 'portal-open');
      expect(opens.length, 'portal-open emitted').to.eq(1);
      expect(opens[0].detail).to.deep.eq({});
    });
    cy.screenshot('billing-status-portal-open');
  });
});
