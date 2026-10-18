/// <reference types="cypress" />
// Isolation lane: noizu-plan-compare with 3 mock plans, no backend.
const PLANS = [
  {id: 'hobby', name: 'Hobby', priceMonthly: 0, priceYearly: 0, features: ['1 project', 'Community support']},
  {id: 'pro', name: 'Pro', priceMonthly: 20, priceYearly: 200, features: ['10 projects', 'Priority support', 'SSO'], ctaLabel: 'Go Pro', highlighted: true},
  {id: 'enterprise', name: 'Enterprise', priceMonthly: 99, priceYearly: 990, features: ['Unlimited projects', 'Dedicated support']},
];
const el = () => cy.get('noizu-plan-compare').shadow();
const events = () => cy.window().then((win: any) => win.__events);

function mount() {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  return cy.window().then((win: any) =>
    win.mount('noizu-plan-compare', {'billing-toggle': '', 'checkout-url-template': 'https://pay.example.test/checkout/{planId}'}, {plans: PLANS}),
  );
}

describe('Given three mock plans on the isolation harness, when the buyer toggles billing and switches layout, then cards, prices and plan-select track the interaction', () => {
  it('Given cards layout with billing toggle, when the toggle and a CTA are clicked, then prices re-render yearly and plan-select emits planId + interpolated checkoutUrl', () => {
    mount();
    el().find('[data-cy="plan.compare"][data-layout="cards"]').should('exist');
    el().find('[data-cy="plan.card"]').should('have.length', 3);
    el().find('[data-cy="plan.card"][data-plan-id="pro"]').should('have.attr', 'data-highlighted');
    el().find('[data-cy="plan.card"][data-plan-id="pro"] [data-cy="plan.cta"]').should('contain', 'Go Pro');
    cy.screenshot('plan-compare-cards-monthly');

    el().find('[data-cy="plan.toggle"]').click().should('have.attr', 'aria-checked', 'true');
    el().find('[data-cy="plan.card"][data-plan-id="pro"] .price')
      .should('have.attr', 'data-interval', 'yearly')
      .and('have.attr', 'data-amount', '200')
      .and('contain', '$200/yr');
    cy.screenshot('plan-compare-cards-yearly');

    el().find('[data-cy="plan.cta"][data-plan-id="enterprise"]').click();
    events().then((evts: any[]) => {
      const selects = evts.filter((e) => e.type === 'plan-select');
      expect(selects, 'exactly one plan-select').to.have.length(1);
      expect(selects[0].detail).to.deep.eq({
        planId: 'enterprise',
        checkoutUrl: 'https://pay.example.test/checkout/enterprise',
        interval: 'yearly',
      });
    });
  });

  it('Given cards layout, when the host switches to table, then the feature matrix renders and CTA clicks still emit plan-select', () => {
    mount();
    cy.window().then((win: any) => {
      win.document.querySelector('noizu-plan-compare').layout = 'table';
    });
    el().find('[data-cy="plan.compare"][data-layout="table"]').should('exist');
    el().find('table').should('contain', 'Plan comparison').and('contain', 'SSO');
    el().find('thead [data-cy="plan.card"]').should('have.length', 3);
    cy.screenshot('plan-compare-table');

    el().find('[data-cy="plan.cta"][data-plan-id="pro"]').click();
    events().then((evts: any[]) => {
      expect(evts.filter((e) => e.type === 'plan-select')[0].detail).to.deep.include({planId: 'pro', interval: 'monthly'});
    });
  });
});
