import {fixture, html, expect, oneEvent, waitUntil} from '@open-wc/testing';
import '../../noizu-waitlist.js';
import type {NoizuWaitlist, WaitlistErrorDetail, WaitlistSuccessDetail} from '../../noizu-waitlist.js';

const DEFAULT_API = 'https://foryou.therobotlives.com';

type FetchCall = {url: string; method: string; body: string | null; credentials: RequestCredentials | undefined};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function emptyManifest() {
  return {list: {name: 'List', attributes: [] as unknown[], settings: {}}};
}

describe('noizu-waitlist', () => {
  const origFetch = window.fetch;
  let calls: FetchCall[];

  afterEach(() => {
    window.fetch = origFetch;
  });

  function mockFetch(
    handler: (url: string, method: string, body: string | null) => Response | Promise<Response>,
  ) {
    calls = [];
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : null;
      const url = req ? req.url : String(input);
      const method = (init?.method || req?.method || 'GET').toUpperCase();
      const body = typeof init?.body === 'string' ? init.body : null;
      const credentials = init?.credentials;
      calls.push({url, method, body, credentials});
      return handler(url, method, body);
    }) as typeof fetch;
  }

  async function waitForm(el: NoizuWaitlist) {
    await waitUntil(() => el.querySelector('[data-cy="waitlist.form"]'), 'form rendered', {
      timeout: 2000,
    });
  }

  it('renders email fallback', async () => {
    mockFetch(() => {
      throw new Error('fetch should not run without slug/service+list');
    });
    const el = await fixture<NoizuWaitlist>(html`<noizu-waitlist></noizu-waitlist>`);
    await waitForm(el);
    const input = el.querySelector<HTMLInputElement>('[data-cy="waitlist.email"]');
    expect(input).to.exist;
    expect(input?.type).to.equal('email');
    expect(input?.required).to.be.true;
    expect(calls).to.have.length(0);
  });

  it('GET+POST happy path fires waitlist-success', async () => {
    mockFetch((_url, method) => {
      if (method === 'GET') {
        return jsonRes({
          list: {
            name: 'Beta',
            attributes: [{slug: 'email', name: 'Email', type: 'email', required: true}],
            settings: {success_message: 'You are in.'},
          },
        });
      }
      return jsonRes({accepted: true}, 202);
    });

    const el = await fixture<NoizuWaitlist>(html`<noizu-waitlist slug="beta"></noizu-waitlist>`);
    await waitForm(el);
    await waitUntil(() => el.querySelector('[data-cy="waitlist.email"]'));

    const input = el.querySelector<HTMLInputElement>('[data-cy="waitlist.email"]')!;
    input.value = 'a@b.co';

    const pending = oneEvent(el, 'waitlist-success');
    el.querySelector<HTMLButtonElement>('[data-cy="waitlist.submit"]')!.click();
    const ev = (await pending) as CustomEvent<WaitlistSuccessDetail>;

    expect(ev.detail.values).to.deep.equal({email: 'a@b.co'});
    expect(ev.detail.status).to.equal(202);
    expect(ev.detail.source).to.equal('widget');
    expect(el.querySelector('.success')).to.exist;
    expect(el.querySelector('[data-cy="waitlist.status"]')?.textContent).to.include('You are in.');

    const get = calls.find((c) => c.method === 'GET');
    const post = calls.find((c) => c.method === 'POST');
    expect(get?.url).to.equal(`${DEFAULT_API}/api/v1/public/lists/beta`);
    expect(get?.credentials).to.equal('omit');
    expect(post?.url).to.equal(`${DEFAULT_API}/api/v1/public/lists/beta/signups`);
    expect(post?.credentials).to.equal('omit');
  });

  it('429 → waitlist-error', async () => {
    mockFetch((_url, method) => {
      if (method === 'GET') return jsonRes(emptyManifest());
      return jsonRes({error: 'rate'}, 429);
    });

    const el = await fixture<NoizuWaitlist>(html`<noizu-waitlist slug="beta"></noizu-waitlist>`);
    await waitForm(el);
    const input = el.querySelector<HTMLInputElement>('[data-cy="waitlist.email"]')!;
    input.value = 'a@b.co';

    const pending = oneEvent(el, 'waitlist-error');
    el.querySelector<HTMLButtonElement>('[data-cy="waitlist.submit"]')!.click();
    const ev = (await pending) as CustomEvent<WaitlistErrorDetail>;

    expect(ev.detail.status).to.equal(429);
    expect(ev.detail.error).to.equal('Too many attempts — please wait a moment and try again.');
    expect(el.querySelector('.danger')).to.exist;
    expect(el.querySelector('[data-cy="waitlist.submit"]')).to.exist;
  });

  it('honeypot included in POST body', async () => {
    mockFetch((_url, method) => {
      if (method === 'GET') return jsonRes(emptyManifest());
      return jsonRes({accepted: true}, 202);
    });

    const el = await fixture<NoizuWaitlist>(
      html`<noizu-waitlist slug="beta" source="landing"></noizu-waitlist>`,
    );
    await waitForm(el);
    el.querySelector<HTMLInputElement>('[data-cy="waitlist.email"]')!.value = 'a@b.co';
    const hp = el.querySelector<HTMLInputElement>('input[name="company_website"]')!;
    expect(hp).to.exist;
    expect(hp.hidden).to.be.true;
    hp.value = 'https://spam.example';

    const pending = oneEvent(el, 'waitlist-success');
    el.querySelector<HTMLButtonElement>('[data-cy="waitlist.submit"]')!.click();
    await pending;

    const post = calls.find((c) => c.method === 'POST');
    expect(post).to.exist;
    const payload = JSON.parse(post!.body ?? '{}') as {
      values: Record<string, unknown>;
      source: string;
      company_website: string;
    };
    expect(payload.company_website).to.equal('https://spam.example');
    expect(payload.source).to.equal('landing');
    expect(payload.values.email).to.equal('a@b.co');
  });

  it('data-cy present', async () => {
    mockFetch(() => jsonRes(emptyManifest()));
    const el = await fixture<NoizuWaitlist>(html`<noizu-waitlist></noizu-waitlist>`);
    await waitForm(el);
    expect(el.querySelector('[data-cy="waitlist.form"]')).to.exist;
    expect(el.querySelector('[data-cy="waitlist.email"]')).to.exist;
    expect(el.querySelector('[data-cy="waitlist.submit"]')).to.exist;
    expect(el.querySelector('[data-cy="waitlist.status"]')).to.exist;
  });
});
