import {expect, fixture, fixtureCleanup, html, oneEvent, waitUntil} from '@open-wc/testing';
import '../../noizu-subscription-gate.js';
import type {GateBlockedDetail, NoizuSubscriptionGate} from '../../noizu-subscription-gate.js';

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function watchNavigate(el: NoizuSubscriptionGate): string[] {
  const calls: string[] = [];
  el.navigate = (href: string) => {
    calls.push(href);
  };
  return calls;
}

describe('noizu-subscription-gate', () => {
  const origFetch = window.fetch;

  afterEach(() => {
    window.fetch = origFetch;
    fixtureCleanup();
    document.querySelectorAll('noizu-subscription-gate').forEach((node) => node.remove());
  });

  it('entitled true shows the default slot', async () => {
    const el = await fixture<NoizuSubscriptionGate>(html`
      <noizu-subscription-gate entitled>
        <p class="paid">secret</p>
      </noizu-subscription-gate>
    `);
    await el.updateComplete;
    const root = el.shadowRoot!.querySelector('[data-cy="gate.root"]');
    const slot = el.shadowRoot!.querySelector('slot');
    expect(root).to.exist;
    expect(el.shadowRoot!.querySelector('[data-cy="gate.blocked"]')).to.equal(null);
    expect(slot).to.exist;
    const assigned = slot!.assignedElements();
    expect(assigned.some((node) => node.classList.contains('paid'))).to.equal(true);
  });

  it('entitled false shows blocked and emits gate-blocked on connect', async () => {
    const el = document.createElement('noizu-subscription-gate') as NoizuSubscriptionGate;
    el.innerHTML = '<p class="paid">secret</p>';
    const pending = oneEvent(el, 'gate-blocked');
    document.body.append(el);
    const event = (await pending) as CustomEvent<GateBlockedDetail>;
    await el.updateComplete;
    expect(event.cancelable).to.equal(true);
    expect(event.detail.redirectTo).to.equal('/pricing');
    expect(el.shadowRoot!.querySelector('[data-cy="gate.root"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-cy="gate.blocked"]')).to.exist;
    const link = el.shadowRoot!.querySelector<HTMLAnchorElement>('[data-cy="gate.link"]');
    expect(link).to.exist;
    expect(link!.getAttribute('href')).to.equal('/pricing');
    expect(el.shadowRoot!.querySelector('slot')).to.equal(null);
    el.remove();
  });

  it('auto-redirect false does not assign location', async () => {
    const el = document.createElement('noizu-subscription-gate') as NoizuSubscriptionGate;
    el.autoRedirect = false;
    const assigned = watchNavigate(el);
    const pending = oneEvent(el, 'gate-blocked');
    document.body.append(el);
    await pending;
    await el.updateComplete;
    expect(assigned).to.deep.equal([]);
    el.remove();
  });

  it('auto-redirect true assigns location unless gate-blocked is canceled', async () => {
    const going = document.createElement('noizu-subscription-gate') as NoizuSubscriptionGate;
    going.autoRedirect = true;
    going.redirectTo = '/plans';
    const goingAssigned = watchNavigate(going);
    const goingEvent = oneEvent(going, 'gate-blocked');
    document.body.append(going);
    await goingEvent;
    expect(goingAssigned).to.deep.equal(['/plans']);
    going.remove();

    const canceled = document.createElement('noizu-subscription-gate') as NoizuSubscriptionGate;
    canceled.autoRedirect = true;
    const canceledAssigned = watchNavigate(canceled);
    canceled.addEventListener('gate-blocked', (event) => event.preventDefault());
    const canceledEvent = oneEvent(canceled, 'gate-blocked');
    document.body.append(canceled);
    await canceledEvent;
    await canceled.updateComplete;
    expect(canceledAssigned).to.deep.equal([]);
    canceled.remove();
  });

  it('check-url 200 {entitled:true} shows the slot and does not emit gate-blocked', async () => {
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).to.include('/entitlement');
      expect((init?.method || 'GET').toUpperCase()).to.equal('GET');
      return jsonRes({entitled: true});
    }) as typeof fetch;

    let fired = 0;
    const wrap = document.createElement('div');
    wrap.addEventListener('gate-blocked', () => {
      fired += 1;
    });
    const el = document.createElement('noizu-subscription-gate') as NoizuSubscriptionGate;
    el.checkUrl = '/entitlement';
    el.innerHTML = '<p class="paid">secret</p>';
    wrap.append(el);
    document.body.append(wrap);
    await waitUntil(() => el.entitled, 'became entitled', {timeout: 2000});
    await el.updateComplete;
    expect(fired).to.equal(0);
    expect(el.shadowRoot!.querySelector('slot')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-cy="gate.blocked"]')).to.equal(null);
    wrap.remove();
  });
});
