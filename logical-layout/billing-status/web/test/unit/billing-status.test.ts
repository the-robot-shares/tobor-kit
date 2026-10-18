import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import '../../noizu-billing-status.js';
import type {NoizuBillingStatus, PortalOpenDetail} from '../../noizu-billing-status.js';

function cy(el: NoizuBillingStatus, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector(`[data-cy="${name}"]`);
}

describe('noizu-billing-status', () => {
  it('renders active status, plan, and renew date', async () => {
    const el = await fixture<NoizuBillingStatus>(html`<noizu-billing-status></noizu-billing-status>`);
    el.subscription = {status: 'active', planName: 'Pro', renewsAt: '2026-10-01'};
    await el.updateComplete;

    expect(cy(el, 'billing.status')?.textContent?.trim()).to.equal('Active');
    expect(cy(el, 'billing.status')?.getAttribute('data-kind')).to.equal('active');
    expect(cy(el, 'billing.plan')?.textContent?.trim()).to.equal('Pro');
    expect(el.shadowRoot!.textContent).to.include('Renews 2026-10-01');
    expect(cy(el, 'billing.portal')?.textContent?.trim()).to.equal('Manage billing');
  });

  it('renders trialing with trial end date', async () => {
    const el = await fixture<NoizuBillingStatus>(html`<noizu-billing-status></noizu-billing-status>`);
    el.subscription = {
      status: 'trialing',
      planName: 'Pro',
      trialEndsAt: '2026-09-15T12:00:00.000Z',
    };
    await el.updateComplete;

    expect(cy(el, 'billing.status')?.textContent?.trim()).to.equal('Trialing');
    expect(cy(el, 'billing.status')?.getAttribute('data-kind')).to.equal('trialing');
    expect(el.shadowRoot!.textContent).to.include('Trial ends 2026-09-15');
  });

  it('renders past_due', async () => {
    const el = await fixture<NoizuBillingStatus>(html`<noizu-billing-status></noizu-billing-status>`);
    el.subscription = {status: 'past_due', planName: 'Pro'};
    await el.updateComplete;

    expect(cy(el, 'billing.status')?.textContent?.trim()).to.equal('Past due');
    expect(cy(el, 'billing.status')?.getAttribute('data-kind')).to.equal('past_due');
    expect(cy(el, 'billing.plan')?.textContent?.trim()).to.equal('Pro');
  });

  it('click portal emits portal-open', async () => {
    const el = await fixture<NoizuBillingStatus>(html`<noizu-billing-status></noizu-billing-status>`);
    el.subscription = {status: 'active'};
    await el.updateComplete;

    const pending = oneEvent(el, 'portal-open');
    cy(el, 'billing.portal')!.click();
    const event = (await pending) as CustomEvent<PortalOpenDetail>;

    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({});
  });
});
