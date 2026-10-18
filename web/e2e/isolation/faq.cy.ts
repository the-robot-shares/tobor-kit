/// <reference types="cypress" />
// Isolation lane: noizu-faq on the blank harness page. Light-DOM wrapper over
// slotted native <details>/<summary> — no backend.
const FAQ_SLOTS = `
  <details><summary>What is tobor-kit?</summary><p>A component kit.</p></details>
  <details><summary>How do I deploy?</summary><p>ArgoCD syncs.</p></details>
  <details><summary>Who maintains it?</summary><p>Noizu Labs.</p></details>
`;
const events = () => cy.window().then((win: any) => win.__events);

function mount(attrs: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  return cy.window().then(async (win: any) => {
    await win.mount('noizu-faq', attrs, {}, FAQ_SLOTS);
    win.__events.length = 0;
  });
}

describe('Given a slotted FAQ list, when items are toggled on the isolation harness, then decorations apply and faq-toggle events carry open state and index', () => {
  it('Given three slotted details, when the list renders, then items are adopted and decorated with faq data-cy hooks', () => {
    mount();
    cy.get('noizu-faq [data-cy="faq.item"]').should('have.length', 3);
    cy.get('noizu-faq [data-cy="faq.trigger"]').should('have.length', 3);
    cy.get('noizu-faq [data-cy="faq.trigger"]').first().should('have.class', 'disclosure-button');
    cy.screenshot('faq-decorated-list');
  });

  it('Given mode many, when summaries are clicked, then multiple items stay open and faq-toggle carries open/index', () => {
    mount();
    cy.get('noizu-faq [data-cy="faq.trigger"]').first().click();
    cy.get('noizu-faq [data-cy="faq.item"]').first().should('have.attr', 'open');
    cy.get('noizu-faq [data-cy="faq.trigger"]').last().click();
    cy.get('noizu-faq [data-cy="faq.item"]').eq(2).should('have.attr', 'open');
    cy.get('noizu-faq [data-cy="faq.item"]').first().should('have.attr', 'open');
    events().then((evts: any[]) => {
      const toggles = evts.filter((e) => e.type === 'faq-toggle');
      expect(toggles.length, 'two faq-toggle events').to.eq(2);
      expect(toggles[0].detail).to.deep.eq({open: true, index: 0});
      expect(toggles[1].detail).to.deep.eq({open: true, index: 2});
    });
    cy.screenshot('faq-many-mode-two-open');
  });

  it('Given mode one, when a second item is opened, then the first closes and a closing faq-toggle fires for it', () => {
    mount({mode: 'one'});
    cy.get('noizu-faq [data-cy="faq.trigger"]').first().click();
    cy.get('noizu-faq [data-cy="faq.trigger"]').eq(1).click();
    cy.get('noizu-faq [data-cy="faq.item"]').first().should('not.have.attr', 'open');
    cy.get('noizu-faq [data-cy="faq.item"]').eq(1).should('have.attr', 'open');
    events().then((evts: any[]) => {
      const toggles = evts.filter((e) => e.type === 'faq-toggle');
      expect(toggles.at(-1)!.detail).to.deep.eq({open: true, index: 1});
      expect(toggles.some((e) => e.detail.open === false && e.detail.index === 0), 'closing toggle for index 0').to.be.true;
    });
    cy.screenshot('faq-one-mode-exclusive');
  });
});
