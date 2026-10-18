import {expect, fixture, html, oneEvent, waitUntil} from '@open-wc/testing';
import {NoizuPlanCompare} from '../../noizu-plan-compare.js';
import type {Plan, PlanSelectDetail} from '../../noizu-plan-compare.js';

const PLANS: Plan[] = [
  {id: 'starter', name: 'Starter', priceMonthly: 9, priceYearly: 90, features: ['1 seat']},
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    priceYearly: 290,
    features: ['5 seats'],
    highlighted: true,
    ctaLabel: 'Go Pro',
  },
  {id: 'team', name: 'Team', priceMonthly: 99, priceYearly: 990, features: ['Unlimited seats']},
];

function cards(el: NoizuPlanCompare) {
  return el.shadowRoot!.querySelectorAll('[data-cy="plan.card"]');
}

function prices(el: NoizuPlanCompare) {
  return [...el.shadowRoot!.querySelectorAll('[part="price"]')];
}

describe('noizu-plan-compare', () => {
  it('renders 3 plans from the plans property', async () => {
    const el = await fixture<NoizuPlanCompare>(
      html`<noizu-plan-compare .plans=${PLANS}></noizu-plan-compare>`,
    );
    expect(cards(el).length).to.equal(3);
    expect([...cards(el)].map((node) => node.getAttribute('data-plan-id'))).to.deep.equal([
      'starter',
      'pro',
      'team',
    ]);
    expect(el.shadowRoot!.querySelector('[data-cy="plan.compare"]')).to.exist;
    expect(prices(el)[0].textContent).to.contain('$9');
  });

  it('click CTA emits plan-select with interpolated URL', async () => {
    const el = await fixture<NoizuPlanCompare>(
      html`<noizu-plan-compare
        .plans=${PLANS}
        checkout-url-template="https://example.com/checkout/{planId}"
      ></noizu-plan-compare>`,
    );
    const cta = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="plan.cta"][data-plan-id="pro"]');
    expect(cta).to.exist;
    const fired = oneEvent(el, 'plan-select');
    cta!.click();
    const event = await fired;
    const detail = event.detail as PlanSelectDetail;
    expect(detail.planId).to.equal('pro');
    expect(detail.checkoutUrl).to.equal('https://example.com/checkout/pro');
    expect(detail.interval).to.equal('monthly');
  });

  it('billing toggle switches displayed price', async () => {
    const el = await fixture<NoizuPlanCompare>(
      html`<noizu-plan-compare .plans=${PLANS} billing-toggle></noizu-plan-compare>`,
    );
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="plan.toggle"]');
    expect(toggle).to.exist;
    expect(toggle!.getAttribute('aria-checked')).to.equal('false');
    expect(prices(el).map((node) => node.getAttribute('data-amount'))).to.deep.equal(['9', '29', '99']);
    expect(prices(el)[0].textContent).to.contain('$9');
    expect(prices(el)[0].getAttribute('data-interval')).to.equal('monthly');

    toggle!.click();
    await el.updateComplete;

    expect(toggle!.getAttribute('aria-checked')).to.equal('true');
    expect(prices(el).map((node) => node.getAttribute('data-amount'))).to.deep.equal(['90', '290', '990']);
    expect(prices(el)[0].textContent).to.contain('$90');
    expect(prices(el)[0].getAttribute('data-interval')).to.equal('yearly');
  });

  it('reads plans from a child application/json script', async () => {
    const el = await fixture<NoizuPlanCompare>(html`<noizu-plan-compare></noizu-plan-compare>`);
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = JSON.stringify(PLANS);
    el.append(script);
    await waitUntil(() => el.plans.length === 3, 'plans hydrated from script');
    await el.updateComplete;
    expect(cards(el).length).to.equal(3);
  });
});
