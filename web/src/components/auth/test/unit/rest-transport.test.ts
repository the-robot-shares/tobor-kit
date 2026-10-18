import {expect, fixture, html, fixtureCleanup} from '@open-wc/testing';
import {NoizuAuth} from '../../noizu-auth.js';
import {AuthRequestError, RestTransport, authRestBase} from '../../transport.js';

type Call = {url: string; init: RequestInit};
type Reply = {status?: number; body?: unknown; text?: string; throws?: Error};

/** A fetch double that records calls and replies from a route table. Any route
 * not in the table answers 404 `{"error":"not_found"}`, so a mis-routed call
 * fails loudly instead of silently passing. */
function stubFetch(routes: Record<string, Reply>) {
  const calls: Call[] = [];
  const impl = (async (input: any, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({url, init});
    const path = new URL(url, location.href).pathname;
    const reply = routes[path];
    if (!reply) return jsonResponse(404, {error: 'not_found'});
    if (reply.throws) throw reply.throws;
    if (reply.text !== undefined) return new Response(reply.text, {status: reply.status ?? 200, headers: {'content-type': 'text/html'}});
    return jsonResponse(reply.status ?? 200, reply.body ?? {});
  }) as unknown as typeof fetch;
  return {calls, impl};
}
const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
const session = {
  user: {id: 'u1', email: 'me@test.com'}, organizations: [{id: 'o1'}],
  access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600,
};
const mergeBody = {
  status: 'merge_required', merge_challenge_id: 'chal-1', expires_at: '2026-09-08T05:31:00Z',
  pipe: 'otp_email', identifier: 'm****@test.com',
  available_pipes: [{pipe: 'password_email', identifier: 'm****@test.com'}, {pipe: 'otp_mobile', identifier: '+1***-***-4821'}],
};
const rest = (impl: typeof fetch, options: Record<string, unknown> = {}) =>
  new RestTransport({apiBase: '/api/v1', fetchImpl: impl, ...options});

describe('RestTransport', () => {
  it('rejects a foreign or malformed api base and normalizes a good one', () => {
    const page = new URL('https://example.test/signin') as unknown as Location;
    expect(authRestBase('/api/v1', page)).to.equal('https://example.test/api/v1');
    expect(authRestBase('https://example.test/api/v1/', page)).to.equal('https://example.test/api/v1');
    for (const base of ['https://evil.test/api', '//evil.test', '/\\evil.test', '/api/v1?x=1'])
      expect(() => authRestBase(base, page), base).to.throw();
  });

  it('posts email login to /auth/login without cookies and returns a Bearer session', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/login': {status: 200, body: session}});
    const result = await rest(impl).request('login', {email: 'me@test.com', password: 'secret123'});
    expect(calls).to.have.length(1);
    expect(new URL(calls[0].url, location.href).pathname).to.equal('/api/v1/auth/login');
    expect(calls[0].init.method).to.equal('POST');
    expect(calls[0].init.credentials).to.equal('omit');
    expect(JSON.parse(String(calls[0].init.body))).to.deep.equal({email: 'me@test.com', password: 'secret123'});
    expect(result.authenticated).to.equal(true);
    expect(result.session).to.deep.equal({
      tokenType: 'Bearer', accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 3600,
      user: session.user, organizations: session.organizations,
    });
  });

  it('sends cookies only when withCredentials is set', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/login': {status: 200, body: session}});
    await rest(impl, {withCredentials: true}).request('login', {email: 'me@test.com', password: 'x'});
    expect(calls[0].init.credentials).to.equal('include');
  });

  it('routes a mobile identifier to the mobile login endpoint', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/mobile/login': {status: 200, body: session}});
    const result = await rest(impl).request('login', {mobile_phone: '+15551234567', password: 'secret123'});
    expect(new URL(calls[0].url, location.href).pathname).to.equal('/api/v1/auth/mobile/login');
    expect(JSON.parse(String(calls[0].init.body))).to.deep.equal({mobile: '+15551234567', password: 'secret123'});
    expect(result.authenticated).to.equal(true);
  });

  it('starts and verifies OTP on the email and mobile variants', async () => {
    const {calls, impl} = stubFetch({
      '/api/v1/auth/otp/email/start': {status: 202, body: {status: 'sent'}},
      '/api/v1/auth/otp/mobile/start': {status: 202, body: {status: 'sent'}},
      '/api/v1/auth/otp/email/verify': {status: 201, body: session},
      '/api/v1/auth/otp/mobile/verify': {status: 200, body: session},
    });
    const client = rest(impl);
    expect(await client.request('otp-request', {email: 'me@test.com'})).to.deep.equal({status: 'sent'});
    expect(await client.request('otp-request', {mobile_phone: '+15551234567'})).to.deep.equal({status: 'sent'});
    expect((await client.request('otp-verify', {email: 'me@test.com', code: '123456'})).authenticated).to.equal(true);
    expect((await client.request('otp-verify', {mobile_phone: '+15551234567', code: '123456'})).authenticated).to.equal(true);
    expect(calls.map(c => new URL(c.url, location.href).pathname)).to.deep.equal([
      '/api/v1/auth/otp/email/start', '/api/v1/auth/otp/mobile/start',
      '/api/v1/auth/otp/email/verify', '/api/v1/auth/otp/mobile/verify',
    ]);
    expect(JSON.parse(String(calls[3].init.body))).to.deep.equal({mobile: '+15551234567', code: '123456'});
  });

  it('maps a 409 merge_required onto the socket transport result shape, masked and re-vocabularied', async () => {
    const {impl} = stubFetch({'/api/v1/auth/otp/email/verify': {status: 409, body: mergeBody}});
    const result = await rest(impl).request('otp-verify', {email: 'me@test.com', code: '123456'});
    expect(result).to.deep.equal({
      merge_required: true, challenge_id: 'chal-1', expires_at: '2026-09-08T05:31:00Z',
      pipes: [{type: 'email_password', masked: 'm****@test.com'}, {type: 'mobile_otp', masked: '+1***-***-4821'}],
    });
    expect(JSON.stringify(result)).not.to.include('access_token');
  });

  it('turns a login carrying merge_challenge_id into POST /auth/merge/confirm with a proof', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/merge/confirm': {status: 200, body: session}});
    const result = await rest(impl).request('login', {email: 'me@test.com', password: 'secret123', merge_challenge_id: 'chal-1'});
    expect(new URL(calls[0].url, location.href).pathname).to.equal('/api/v1/auth/merge/confirm');
    expect(JSON.parse(String(calls[0].init.body))).to.deep.equal({
      challenge_id: 'chal-1',
      proof: {pipe: 'password_email', identifier: 'me@test.com', password: 'secret123'},
    });
    expect(result.merge_confirmed).to.equal(true);
    expect(result.authenticated).to.equal(true);
  });

  it('confirms a merge through a mobile OTP pipe with a code proof', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/merge/confirm': {status: 200, body: session}});
    await rest(impl).request('otp-verify', {mobile_phone: '+15551234567', code: '654321', merge_challenge_id: 'chal-1'});
    expect(JSON.parse(String(calls[0].init.body)).proof).to.deep.equal({
      pipe: 'otp_mobile', identifier: '+15551234567', code: '654321',
    });
  });

  it('describes a challenge over GET /auth/merge/:challenge_id', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/merge/chal-1': {status: 200, body: {available_pipes: [{pipe: 'otp_email', identifier: 'm****@test.com'}]}}});
    await rest(impl).request('merge-describe', {challenge_id: 'chal-1'});
    expect(calls[0].init.method).to.equal('GET');
    expect(new URL(calls[0].url, location.href).pathname).to.equal('/api/v1/auth/merge/chal-1');
  });

  it('maps 422 sms_region_unsupported onto the shared AuthRequestError code', async () => {
    const {impl} = stubFetch({'/api/v1/auth/otp/mobile/start': {status: 422, body: {error: 'sms_region_unsupported'}}});
    const error = await rest(impl).request('otp-request', {mobile_phone: '+447911123456'}).catch(e => e);
    expect(error).to.be.instanceOf(AuthRequestError);
    expect(error.code).to.equal('sms_region_unsupported');
    expect(error.message).to.equal('SMS is not currently available for this region.');
  });

  it('normalizes documented REST error codes into public copy', async () => {
    const cases: Array<[number, string, string]> = [
      [401, 'invalid_credentials', 'That email or password is not correct.'],
      [401, 'expired_code', 'That verification code has expired. Request a new one.'],
      [429, 'rate_limited', 'Too many requests. Try again in a few minutes.'],
      [403, 'pipe_not_permitted', 'That sign-in method is not available for this account.'],
    ];
    for (const [status, code, message] of cases) {
      const {impl} = stubFetch({'/api/v1/auth/login': {status, body: {error: code}}});
      const error = await rest(impl).request('login', {email: 'a@b.test', password: 'x'}).catch(e => e);
      expect(error.code, code).to.equal(code);
      expect(error.message, code).to.equal(message);
    }
  });

  it('survives a non-JSON error body and an empty body', async () => {
    const {impl} = stubFetch({'/api/v1/auth/login': {status: 502, text: '<html><body>Bad Gateway</body></html>'}});
    const error = await rest(impl).request('login', {email: 'a@b.test', password: 'x'}).catch(e => e);
    expect(error).to.be.instanceOf(AuthRequestError);
    expect(error.code).to.equal('http_502');
    expect(error.message).to.equal('Authentication could not be completed.');
    const empty = stubFetch({'/api/v1/auth/login': {status: 500, text: ''}});
    const second = await rest(empty.impl).request('login', {email: 'a@b.test', password: 'x'}).catch(e => e);
    expect(second.code).to.equal('http_500');
  });

  it('turns a network failure into the same error shape as a socket drop', async () => {
    const {impl} = stubFetch({'/api/v1/auth/login': {throws: new TypeError('Failed to fetch')}});
    const error = await rest(impl).request('login', {email: 'a@b.test', password: 'x'}).catch(e => e);
    expect(error).to.be.instanceOf(AuthRequestError);
    expect(error.code).to.equal('network_error');
    expect(error.message).to.equal('Authentication connection failed.');
  });

  it('degrades a missing discovery endpoint to an empty config instead of failing the form', async () => {
    const {impl} = stubFetch({});
    expect(await rest(impl).request('config')).to.deep.equal({});
  });

  it('refuses methods the REST contract does not define', async () => {
    const {calls, impl} = stubFetch({});
    const error = await rest(impl).request('magic-link', {email: 'a@b.test'}).catch(e => e);
    expect(error.code).to.equal('unsupported_method');
    expect(calls).to.have.length(0);
  });

  it('registers a mobile-first account against /auth/mobile/register', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/mobile/register': {status: 201, body: session}});
    await rest(impl).request('register', {user: {mobile_phone: '+15551234567', password: 'secret123', user_name: 'robot', code: '123456'}});
    expect(new URL(calls[0].url, location.href).pathname).to.equal('/api/v1/auth/mobile/register');
    expect(JSON.parse(String(calls[0].init.body))).to.deep.equal({mobile: '+15551234567', password: 'secret123', code: '123456', user_name: 'robot'});
  });

  it('registers an email account against /auth/register', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/register': {status: 201, body: session}});
    await rest(impl).request('register', {user: {email: 'me@test.com', password: 'secret123', user_name: 'robot', first_name: 'The', last_name: 'Robot'}, invite_token: 'invite123'});
    expect(new URL(calls[0].url, location.href).pathname).to.equal('/api/v1/auth/register');
    expect(JSON.parse(String(calls[0].init.body))).to.deep.equal({
      user: {email: 'me@test.com', password: 'secret123', user_name: 'robot', first_name: 'The', last_name: 'Robot'},
      invite_token: 'invite123',
    });
  });

  it('forwards a mobile_phone in the nested user and omits invite_token when unset', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/register': {status: 201, body: session}});
    await rest(impl).request('register', {user: {email: 'me@test.com', password: 'secret123', user_name: 'robot', first_name: 'The', last_name: 'Robot', mobile_phone: '+15551234567'}});
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.user.mobile_phone).to.equal('+15551234567');
    expect('invite_token' in body).to.equal(false);
  });
});

describe('<noizu-auth> transport selection', () => {
  const nativeFetch = globalThis.fetch;
  const nativeWebSocket = globalThis.WebSocket;
  afterEach(() => {fixtureCleanup(); globalThis.fetch = nativeFetch; globalThis.WebSocket = nativeWebSocket;});

  const settle = async (el: NoizuAuth) => {await el.updateComplete; await new Promise(r => setTimeout(r, 0)); await el.updateComplete;};
  const fill = (el: NoizuAuth, name: string, value: string) => {
    const input = el.shadowRoot!.querySelector<HTMLInputElement>(`[name=${name}]`)!;
    input.value = value; input.dispatchEvent(new Event('input'));
  };
  const submit = (el: NoizuAuth) => el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));

  it('REGRESSION: with transport unset, opens a WebSocket and never calls fetch', async () => {
    let fetched = 0, sockets = 0;
    globalThis.fetch = (async () => {fetched++; return jsonResponse(200, {});}) as unknown as typeof fetch;
    class Socket extends EventTarget {
      static OPEN = 1; static CONNECTING = 0; readyState = 0;
      constructor(readonly url: string) {super(); sockets++; queueMicrotask(() => {this.readyState = 1; this.dispatchEvent(new Event('open'));});}
      send() {} close() {}
    }
    globalThis.WebSocket = Socket as unknown as typeof WebSocket;
    const el = await fixture<NoizuAuth>(html`<noizu-auth></noizu-auth>`); await settle(el);
    expect(el.transport).to.equal(undefined);
    expect(sockets).to.equal(1);
    expect(fetched).to.equal(0);
  });

  it('drives the whole pipe flow over REST and hands the Bearer session to the host', async () => {
    const {calls, impl} = stubFetch({'/api/v1/auth/login': {status: 200, body: session}});
    globalThis.fetch = impl;
    globalThis.WebSocket = (function () {throw new Error('the REST transport must not open a socket');}) as unknown as typeof WebSocket;
    let detail: any, aliasDetail: any;
    const el = await fixture<NoizuAuth>(html`<noizu-auth transport="rest" api-base="/api/v1" .pipes=${['email_password']}></noizu-auth>`);
    await settle(el);
    el.addEventListener('auth-success', e => {detail = (e as CustomEvent).detail;});
    el.addEventListener('noizu-auth-success', e => {aliasDetail = (e as CustomEvent).detail;});
    fill(el, 'email', 'me@test.com'); fill(el, 'password', 'secret123');
    submit(el); await settle(el);
    expect(calls.some(c => new URL(c.url, location.href).pathname === '/api/v1/auth/login')).to.equal(true);
    expect(detail.session.accessToken).to.equal('access-1');
    expect(detail.session.tokenType).to.equal('Bearer');
    expect(aliasDetail.session.refreshToken).to.equal('refresh-1');
  });

  it('renders a REST 409 through the same merge_required UI as the socket transport', async () => {
    const {impl} = stubFetch({'/api/v1/auth/login': {status: 409, body: mergeBody}});
    globalThis.fetch = impl;
    let merge: any;
    const el = await fixture<NoizuAuth>(html`<noizu-auth transport="rest" .pipes=${['email_password']}></noizu-auth>`);
    await settle(el);
    el.addEventListener('noizu-auth-merge-required', e => {merge = (e as CustomEvent).detail;});
    fill(el, 'email', 'me@test.com'); fill(el, 'password', 'secret123');
    submit(el); await settle(el);
    expect(merge.challengeId).to.equal('chal-1');
    expect(merge.pipes).to.deep.equal([{type: 'email_password', masked: 'm****@test.com'}, {type: 'mobile_otp', masked: '+1***-***-4821'}]);
    expect(el.shadowRoot!.querySelector('[data-cy=merge-required]')).to.exist;
    expect(el.shadowRoot!.textContent).to.include('m****@test.com');
  });

  it('treats a github pipe in a REST 409 challenge as SSO: provider link, not a form', async () => {
    const {impl} = stubFetch({'/api/v1/auth/login': {status: 409, body: {...mergeBody, available_pipes: [{pipe: 'github', identifier: '***'}]}}});
    globalThis.fetch = impl;
    const el = await fixture<NoizuAuth>(html`<noizu-auth transport="rest" .pipes=${['email_password']}></noizu-auth>`);
    await settle(el);
    fill(el, 'email', 'me@test.com'); fill(el, 'password', 'secret123');
    submit(el); await settle(el);
    const option = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy=merge-pipe-option]')!;
    expect(option.dataset.pipeType).to.equal('github');
    option.click(); await settle(el);
    expect(el.shadowRoot!.querySelector('[data-cy=sso-provider-link]')).to.exist;
    expect(el.shadowRoot!.querySelector('form[data-cy=merge-confirm-form]')).to.not.exist;
  });

  it('renders a REST 422 sms_region_unsupported in the inline region notice, not the error banner', async () => {
    const {impl} = stubFetch({'/api/v1/auth/mobile/login': {status: 422, body: {error: 'sms_region_unsupported', message: 'Server: this area code is not SMS-enabled.'}}});
    globalThis.fetch = impl;
    let unsupported: any;
    const el = await fixture<NoizuAuth>(html`<noizu-auth transport="rest" .pipes=${['mobile_password']} .smsRegions=${{supported: ['US']}}></noizu-auth>`);
    await settle(el);
    el.addEventListener('noizu-auth-sms-region-unsupported', e => {unsupported = (e as CustomEvent).detail;});
    const phone = el.shadowRoot!.querySelector('noizu-phone-input') as any;
    phone.value = '+15551234567'; phone.dispatchEvent(new CustomEvent('phone-change', {detail: {value: '+15551234567'}}));
    fill(el, 'password', 'secret123'); submit(el); await settle(el);
    const notice = el.shadowRoot!.querySelector<HTMLElement>('[data-cy="sms-region-notice"]')!;
    expect(notice.hidden).to.equal(false);
    expect(notice.textContent).to.include('Server: this area code is not SMS-enabled.');
    expect(el.shadowRoot!.querySelector('[data-cy="auth-error"]')!.textContent).to.equal('');
    expect(unsupported.pipe).to.equal('mobile_password');
  });

  it('surfaces a REST network failure through the same error banner as a socket failure', async () => {
    const {impl} = stubFetch({'/api/v1/auth/login': {throws: new TypeError('Failed to fetch')}});
    globalThis.fetch = impl;
    let error: any;
    const el = await fixture<NoizuAuth>(html`<noizu-auth transport="rest" .pipes=${['email_password']}></noizu-auth>`);
    await settle(el);
    el.addEventListener('noizu-auth-error', e => {error = (e as CustomEvent).detail;});
    fill(el, 'email', 'me@test.com'); fill(el, 'password', 'secret123');
    submit(el); await settle(el);
    expect(error.message).to.equal('Authentication connection failed.');
    expect(el.shadowRoot!.querySelector('[data-cy="auth-error"]')!.textContent).to.include('Authentication connection failed.');
  });
});
