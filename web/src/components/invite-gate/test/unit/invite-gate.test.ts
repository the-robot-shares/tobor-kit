import {expect, fixture, fixtureCleanup, html, oneEvent} from '@open-wc/testing';
import {NoizuInviteGate, classifyInviteRedeemError} from '../../noizu-invite-gate.js';
import {
  InviteRequiredError, handleInviteRequired, isInviteRequiredResponse, sameOriginUrl, userNeedsInvite, withInviteGate,
} from '../../invite-required.js';

// `location.assign` is unforgeable in Chrome: the harness records navigation instead.
class GateHarness extends NoizuInviteGate {
  static navigated: string[] = [];
  protected override navigateTo(url: string) {GateHarness.navigated.push(url);}
}
customElements.define('noizu-invite-gate-test', GateHarness);

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? '' : JSON.stringify(body), {status, headers: {'content-type': 'application/json', ...headers}});
const settle = async (el: NoizuInviteGate) => {await el.updateComplete; await new Promise(r => setTimeout(r, 0)); await el.updateComplete;};
const q = <T extends Element = HTMLElement>(el: NoizuInviteGate, cy: string) => el.shadowRoot!.querySelector<T>(`[data-cy="${cy}"]`)!;
const typeCode = (el: NoizuInviteGate, value: string) => {const input = q<HTMLInputElement>(el, 'invite-code-input'); input.value = value; input.dispatchEvent(new Event('input'));};
const submit = (el: NoizuInviteGate) => q<HTMLFormElement>(el, 'invite-redeem-form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));

describe('noizu-invite-gate', () => {
  const origFetch = window.fetch;
  let calls: {url: string; init: RequestInit}[] = [];
  const stubFetch = (response: () => Response | Promise<Response>) => {
    window.fetch = (async (url: RequestInfo | URL, init: RequestInit = {}) => {calls.push({url: String(url), init}); return response();}) as typeof fetch;
  };
  beforeEach(() => {calls = []; GateHarness.navigated = [];});
  afterEach(() => {window.fetch = origFetch; fixtureCleanup();});

  it('renders the interstitial card with label, alert region and account links', async () => {
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test brand="therobotplans" email="me@test.com"></noizu-invite-gate-test>`);
    expect(q(el, 'invite-title').textContent).to.equal("you're in — one step left");
    expect(q(el, 'invite-description').textContent).to.include('me@test.com');
    expect(q(el, 'invite-description').textContent).to.include('therobotplans is invite-only right now');
    const input = q<HTMLInputElement>(el, 'invite-code-input');
    expect(el.shadowRoot!.querySelector(`label[for="${input.id}"]`)!.textContent).to.equal('invite code');
    expect(el.shadowRoot!.activeElement).to.equal(input);
    const error = q(el, 'invite-error');
    expect(error.getAttribute('role')).to.equal('alert');
    expect(error.hidden).to.equal(true);
    expect(input.getAttribute('aria-describedby')).to.equal(error.id);
    expect(q(el, 'invite-profile-link').getAttribute('href')).to.equal('/app/profile');
    expect(q(el, 'invite-settings-link').getAttribute('href')).to.equal('/app/settings');
    expect(q(el, 'invite-sign-out')).to.exist;
  });

  it('hides a link whose URL is empty and refuses off-origin links', async () => {
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test profile-url="" settings-url="https://evil.test/settings"></noizu-invite-gate-test>`);
    expect(q(el, 'invite-profile-link')).to.equal(null);
    expect(q(el, 'invite-settings-link')).to.equal(null);
  });

  it('prefills from the token attribute', async () => {
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test token="AbC123"></noizu-invite-gate-test>`);
    expect(q<HTMLInputElement>(el, 'invite-code-input').value).to.equal('AbC123');
  });

  it('posts the trimmed code with the Bearer token, then emits redeemed and continues', async () => {
    stubFetch(() => json({organization_id: 'o1', role: 'member', invite_required: false}));
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test continue-url="/app/projects" .accessToken=${'tok-1'}></noizu-invite-gate-test>`);
    typeCode(el, '  AbC123  ');
    const redeemed = oneEvent(el, 'noizu-invite-redeemed');
    submit(el);
    const event = await redeemed; await settle(el);
    expect(calls).to.have.length(1);
    expect(calls[0].url).to.equal('/api/v1/invites/redeem');
    expect(calls[0].init.method).to.equal('POST');
    expect(JSON.parse(String(calls[0].init.body))).to.deep.equal({token: 'AbC123'});
    expect((calls[0].init.headers as Record<string, string>).authorization).to.equal('Bearer tok-1');
    expect(calls[0].init.credentials).to.equal('same-origin');
    expect(event.detail).to.deep.equal({result: {organization_id: 'o1', role: 'member', invite_required: false}, continueUrl: '/app/projects'});
    expect(q(el, 'invite-status').textContent).to.include('invite accepted');
    expect(GateHarness.navigated).to.deep.equal(['/app/projects']);
  });

  it('does not navigate when noizu-invite-redeemed is canceled', async () => {
    stubFetch(() => json({}));
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test></noizu-invite-gate-test>`);
    el.addEventListener('noizu-invite-redeemed', (e) => e.preventDefault());
    expect(await el.redeem('code')).to.equal(true);
    expect(GateHarness.navigated).to.deep.equal([]);
  });

  const failures: [string, () => Response, string, string][] = [
    ['unknown/revoked (404)', () => json({error: 'Invalid or expired invite token'}, 404), 'invalid', 'invalid or expired'],
    ['used (409)', () => json({error: 'This invite has already been used'}, 409), 'used', 'already been used'],
    ['rate-limited (429)', () => json(undefined, 429), 'rate_limited', 'too many attempts'],
    ['expired (410)', () => json({error: 'invite_expired'}, 410), 'expired', 'has expired'],
    ['signed out (401)', () => json({error: 'unauthorized'}, 401), 'unauthenticated', 'sign in again'],
    ['server error (500)', () => json(undefined, 500), 'failure', 'something went wrong'],
  ];
  for (const [name, response, code, copy] of failures) {
    it(`shows the ${code} state for ${name}, announces it, and refocuses the input`, async () => {
      stubFetch(response);
      const el = await fixture<GateHarness>(html`<noizu-invite-gate-test></noizu-invite-gate-test>`);
      typeCode(el, 'bad-code');
      const failed = oneEvent(el, 'noizu-invite-error');
      submit(el);
      const event = await failed; await settle(el);
      expect(event.detail.code).to.equal(code);
      const error = q(el, 'invite-error');
      expect(error.hidden).to.equal(false);
      expect(error.textContent).to.include(copy);
      expect(error.dataset.code).to.equal(code);
      expect(q(el, 'invite-code-input').getAttribute('aria-invalid')).to.equal('true');
      expect(el.shadowRoot!.activeElement).to.equal(q(el, 'invite-code-input'));
      expect(GateHarness.navigated).to.deep.equal([]);
    });
  }

  it('maps a network failure to the generic state', async () => {
    stubFetch(() => {throw new TypeError('Failed to fetch');});
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test></noizu-invite-gate-test>`);
    expect(await el.redeem('code')).to.equal(false);
    await settle(el);
    expect(q(el, 'invite-error').dataset.code).to.equal('failure');
  });

  it('blocks an empty submit without a request', async () => {
    stubFetch(() => json({}));
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test></noizu-invite-gate-test>`);
    typeCode(el, '   '); submit(el); await settle(el);
    expect(calls).to.have.length(0);
    expect(q(el, 'invite-error').textContent).to.include('enter your invite code');
  });

  it('never sends the code to an off-origin endpoint', async () => {
    stubFetch(() => json({}));
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test endpoint="https://evil.test/redeem" .accessToken=${'tok'}></noizu-invite-gate-test>`);
    expect(await el.redeem('code')).to.equal(false);
    expect(calls).to.have.length(0);
  });

  it('uses the redeemer hook instead of fetch and classifies its error status', async () => {
    stubFetch(() => json({}));
    const seen: string[] = [];
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test .redeemer=${async (token: string) => {
      seen.push(token);
      throw Object.assign(new Error('This invite has already been used'), {status: 409});
    }}></noizu-invite-gate-test>`);
    expect(await el.redeem('abc')).to.equal(false);
    await settle(el);
    expect(seen).to.deep.equal(['abc']);
    expect(calls).to.have.length(0);
    expect(q(el, 'invite-error').dataset.code).to.equal('used');
  });

  it('emits sign-out and navigates to sign-out-url unless canceled', async () => {
    const el = await fixture<GateHarness>(html`<noizu-invite-gate-test sign-out-url="/logout"></noizu-invite-gate-test>`);
    const out = oneEvent(el, 'noizu-invite-sign-out');
    q<HTMLButtonElement>(el, 'invite-sign-out').click();
    expect((await out).detail).to.deep.equal({url: '/logout'});
    expect(GateHarness.navigated).to.deep.equal(['/logout']);
    el.addEventListener('noizu-invite-sign-out', (e) => e.preventDefault());
    q<HTMLButtonElement>(el, 'invite-sign-out').click();
    expect(GateHarness.navigated).to.deep.equal(['/logout']);
  });

  it('classifies messages when no status is known', () => {
    expect(classifyInviteRedeemError(undefined, 'Invalid or expired invite token')).to.equal('invalid');
    expect(classifyInviteRedeemError(undefined, 'invite expired')).to.equal('expired');
    expect(classifyInviteRedeemError(undefined, 'This invite has already been used')).to.equal('used');
    expect(classifyInviteRedeemError(undefined, 'Too many requests')).to.equal('rate_limited');
    expect(classifyInviteRedeemError(undefined, 'boom')).to.equal('failure');
  });
});

describe('invite-required helpers', () => {
  const origFetch = window.fetch;
  afterEach(() => {window.fetch = origFetch;});

  it('recognises only the 403 invite_required contract', () => {
    expect(isInviteRequiredResponse(403, {error: 'invite_required'})).to.equal(true);
    expect(isInviteRequiredResponse(403, {error: {code: 'invite_required'}})).to.equal(true);
    expect(isInviteRequiredResponse(403, undefined, 'Bearer realm="mcp", scope="invite_required", error="insufficient_scope"')).to.equal(true);
    expect(isInviteRequiredResponse(401, {error: 'invite_required'})).to.equal(false);
    expect(isInviteRequiredResponse(403, {error: 'forbidden'})).to.equal(false);
    expect(isInviteRequiredResponse(403, undefined, 'Bearer error="insufficient_scope", scope="admin"')).to.equal(false);
  });

  it('reads the authoritative flag, falling back to pending/waitlist', () => {
    expect(userNeedsInvite({invite_required: false, status: 'pending'})).to.equal(false);
    expect(userNeedsInvite({invite_required: true, status: 'active'})).to.equal(true);
    expect(userNeedsInvite({status: 'waitlist'})).to.equal(true);
    expect(userNeedsInvite({status: 'active'})).to.equal(false);
    expect(userNeedsInvite(null)).to.equal(false);
  });

  it('keeps same-origin paths and rejects everything else', () => {
    const page = new URL('https://app.test/signup');
    expect(sameOriginUrl('/auth/invite-required', 'x', page)).to.equal('/auth/invite-required');
    expect(sameOriginUrl('https://app.test/app?x=1', 'x', page)).to.equal('/app?x=1');
    for (const bad of ['https://evil.test/', '//evil.test/', '/\\evil.test', 'javascript:alert(1)', '']) expect(sameOriginUrl(bad, 'fallback', page), bad).to.equal('fallback');
  });

  it('handleInviteRequired redirects on the gate and leaves the body readable', async () => {
    const navigated: string[] = [];
    const gated = json({error: 'invite_required', account_status: 'pending'}, 403);
    expect(await handleInviteRequired(gated, {navigate: (u) => navigated.push(u)})).to.equal(true);
    expect(await gated.json()).to.deep.equal({error: 'invite_required', account_status: 'pending'});
    expect(await handleInviteRequired(json({error: 'forbidden'}, 403), {navigate: (u) => navigated.push(u)})).to.equal(false);
    expect(await handleInviteRequired(json({ok: true}), {navigate: (u) => navigated.push(u)})).to.equal(false);
    expect(navigated).to.deep.equal(['/auth/invite-required']);
  });

  it('handleInviteRequired does not loop when already on the interstitial', async () => {
    const navigated: string[] = [];
    await handleInviteRequired(json({error: 'invite_required'}, 403), {url: location.pathname, navigate: (u) => navigated.push(u)});
    expect(navigated).to.deep.equal([]);
  });

  it('withInviteGate rejects gated responses and passes the rest through', async () => {
    const navigated: string[] = [];
    let next: Response = json({error: 'invite_required'}, 403);
    const gatedFetch = withInviteGate(async () => next, {url: '/join', navigate: (u) => navigated.push(u)});
    const error = await gatedFetch('/api/v1/projects').catch((e) => e);
    expect(error).to.be.instanceOf(InviteRequiredError);
    expect(error.url).to.equal('/join');
    expect(navigated).to.deep.equal(['/join']);
    next = json({error: 'forbidden'}, 403);
    expect((await gatedFetch('/api/v1/projects')).status).to.equal(403);
    next = json({ok: true});
    expect(await (await gatedFetch('/api/v1/projects')).json()).to.deep.equal({ok: true});
  });
});
