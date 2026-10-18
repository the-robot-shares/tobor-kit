import {expect, fixture, html, fixtureCleanup} from '@open-wc/testing';
import {NoizuAuth} from '../../noizu-auth.js';

/**
 * `layout="console"` — the sign-in-console arrangement of the `pipes` surface.
 *
 * What these pin is the *structure*, because that is what the layout exists to
 * change and what a host's own selectors depend on: social providers first, an
 * `or` rule only when there is something to separate, a segmented identifier
 * toggle only when both password pipes are enabled, one-time codes as links
 * rather than tabs, and a footer that offers the opposite flow. The credential
 * exchange underneath is the same state machine the tab layout drives and is
 * covered by `auth.test.ts`; nothing here re-tests it.
 */

const CONFIG = {
  providers: [
    {id: 'google', label: 'Continue with Google', href: '/auth/google'},
    {id: 'oidc', label: 'Continue with SSO', href: '/auth/oidc'},
    {id: 'github', label: 'Continue with GitHub', href: '/auth/github'},
  ],
};

/**
 * Discovery is served by stubbing `fetch`, not by replacing the element's
 * transport: the REST transport's own `/auth/config` handling (including its
 * degrade-to-`{}` on failure) is then part of what these exercise, and the
 * test makes no network request to 404 on.
 */
const served = {config: CONFIG as unknown};
const nativeFetch = globalThis.fetch;

function serveConfig() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.includes('/auth/config')) {
      return new Response(JSON.stringify(served.config), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
    }
    return new Response('{}', {status: 200, headers: {'content-type': 'application/json'}});
  }) as typeof fetch;
}

const settle = async (el: NoizuAuth) => {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

async function console_(pipes: string[], attrs: {flow?: 'login' | 'signup'} = {}) {
  const el = await fixture<NoizuAuth>(
    html`<noizu-auth
      layout="console"
      flow=${attrs.flow ?? 'login'}
      transport="rest"
      api-base="/api/v1"
      .pipes=${pipes as never}
    ></noizu-auth>`,
  );
  await settle(el);
  return el;
}

const q = (el: NoizuAuth, selector: string) => el.shadowRoot!.querySelector(selector);
const all = (el: NoizuAuth, selector: string) => [...el.shadowRoot!.querySelectorAll(selector)];
const text = (el: NoizuAuth, selector: string) => q(el, selector)?.textContent?.trim() ?? '';

describe('noizu-auth layout="console"', () => {
  beforeEach(() => {
    served.config = CONFIG;
    serveConfig();
  });
  afterEach(() => {
    fixtureCleanup();
    globalThis.fetch = nativeFetch;
  });

  it('is the default layout when `layout` is not set', async () => {
    const el = await fixture<NoizuAuth>(
      html`<noizu-auth transport="rest" .pipes=${['email_password', 'google'] as never}></noizu-auth>`,
    );
    await settle(el);
    expect(el.layout).to.equal('console');
    expect(q(el, '[part~=providers]'), 'console social grid rendered').to.exist;
    expect(q(el, '[data-cy=pipe-list]'), 'flat tab row absent').to.not.exist;
  });

  it('restores the flat pipe row for a host that opts back in with layout="tabs"', async () => {
    const el = await fixture<NoizuAuth>(
      html`<noizu-auth layout="tabs" transport="rest" .pipes=${['email_password', 'google'] as never}></noizu-auth>`,
    );
    await settle(el);
    expect(q(el, '[data-cy=pipe-list]'), 'tab pipe row still rendered').to.exist;
    expect(q(el, '[part~=console-foot]'), 'console chrome absent').to.not.exist;
  });

  it('orders social providers, the rule, the credential form and the code links', async () => {
    const el = await console_(['email_password', 'email_otp', 'google', 'authentik', 'github']);

    const order = all(el, '[part~=providers],[part~=divider],[part~=form],[part~=otp-links],[part~=console-foot]')
      .map((node) => node.getAttribute('part')!.split(' ')[0]);
    expect(order).to.deep.equal(['providers', 'divider', 'form', 'otp-links', 'console-foot']);

    expect(text(el, '[part~=description]')).to.equal("choose how you'd like to continue");
    expect(all(el, '[part~=sso-button]')).to.have.length(3);
    expect(text(el, '[part~=divider] em')).to.equal('or');
  });

  it('matches the authentik pipe against a provider published as `oidc`', async () => {
    const el = await console_(['email_password', 'authentik']);
    const sso = q(el, '[data-cy=sso-provider-link]') as HTMLButtonElement;

    expect(sso, 'authentik renders with the shared SSO selector pair').to.exist;
    expect(sso.getAttribute('data-cy-id')).to.equal('oidc');
    expect(sso.disabled, 'an `oidc` provider entry enables the authentik pipe').to.equal(false);
  });

  it('disables a social pipe the server did not publish and names it once', async () => {
    served.config = {providers: [{id: 'google', label: 'Continue with Google', href: '/auth/google'}]};
    const el = await console_(['email_password', 'google', 'github']);

    const github = q(el, '[data-cy=pipe-github]') as HTMLButtonElement;
    expect(github.disabled).to.equal(true);
    expect((q(el, '[data-cy=pipe-google]') as HTMLButtonElement).disabled).to.equal(false);
    // The note names the provider, not the whole button sentence.
    const note = text(el, '[data-cy=sso-unavailable]');
    expect(note).to.contain('GitHub');
    expect(note, 'the button sentence is not repeated').to.not.contain('Continue with');
  });

  it('drops the rule when there is nothing to separate', async () => {
    const el = await console_(['email_password', 'email_otp']);
    expect(q(el, '[part~=providers]')).to.not.exist;
    expect(q(el, '[part~=divider]')).to.not.exist;
    expect(q(el, '[part~=form]')).to.exist;
  });

  it('shows the identifier toggle only when both password pipes are enabled', async () => {
    const emailOnly = await console_(['email_password', 'email_otp']);
    expect(q(emailOnly, '[part~=segments]'), 'no dead mobile control').to.not.exist;

    const both = await console_(['email_password', 'mobile_password']);
    const segments = all(both, '[part~=segment]') as HTMLButtonElement[];
    expect(segments.map((s) => s.textContent!.trim())).to.deep.equal(['email', 'mobile']);
    expect(segments[0].getAttribute('aria-selected')).to.equal('true');
  });

  it('switches the credential form to the mobile pipe via the toggle', async () => {
    const el = await console_(['email_password', 'mobile_password']);
    (el.shadowRoot!.querySelector('[data-cy=cred-mode-mobile]') as HTMLButtonElement).click();
    await settle(el);

    expect(q(el, '[data-cy=pipe-form-mobile_password]')).to.exist;
    expect(q(el, 'noizu-phone-input'), 'mobile identifier field').to.exist;
  });

  it('renders one-time codes as links and opens the pipe with a way back', async () => {
    const el = await console_(['email_password', 'email_otp', 'mobile_otp']);
    const links = all(el, '[part~=otp-link]') as HTMLButtonElement[];
    expect(links.map((l) => l.textContent!.trim())).to.deep.equal(['email me a code', 'text me a code']);

    links[0].click();
    await settle(el);
    expect(q(el, '[data-cy=pipe-form]'), 'the pipe form replaces the console root').to.exist;
    expect(q(el, '[part~=otp-links]'), 'console root is gone while a pipe is open').to.not.exist;

    (el.shadowRoot!.querySelector('[data-cy=pipe-back]') as HTMLButtonElement).click();
    await settle(el);
    expect(q(el, '[part~=otp-links]'), 'back returns to the console root').to.exist;
  });

  it('offers the opposite flow in the footer and switches to it in place', async () => {
    const el = await console_(['email_password', 'google']);
    expect(text(el, '[part~=console-foot]')).to.contain('new here?');

    const toggle = el.shadowRoot!.querySelector('[data-cy=signup-link]') as HTMLButtonElement;
    expect(toggle.textContent!.trim()).to.equal('get started');
    toggle.click();
    await settle(el);

    expect(el.flow).to.equal('signup');
    expect(text(el, '[part~=console-foot]')).to.contain('already have an account?');
    expect(q(el, '[data-cy=user_name-input]'), 'signup collects a username').to.exist;
  });

  it('does not render the tab layout footer twice', async () => {
    const el = await console_(['email_password', 'google']);
    expect(all(el, '[part~=flow-toggle]')).to.have.length(1);
  });

  it('accepts copy overrides for every console string', async () => {
    const el = await fixture<NoizuAuth>(
      html`<noizu-auth
        layout="console"
        transport="rest"
        .pipes=${['email_password', 'email_otp'] as never}
        .text=${{chooseMethod: 'pick one', or: 'ou', emailCodeLink: 'send a code', needAccount: 'first time?', getStarted: 'start'}}
      ></noizu-auth>`,
    );
    await settle(el);

    expect(text(el, '[part~=description]')).to.equal('pick one');
    expect(text(el, '[part~=otp-link]')).to.equal('send a code');
    expect(text(el, '[part~=console-foot]')).to.contain('first time?');
    expect(text(el, '[part~=console-foot]')).to.contain('start');
  });

  it('reads the reference register by default and still takes overrides', async () => {
    const el = await console_(['email_password', 'email_otp', 'mobile_password', 'mobile_otp', 'google', 'authentik']);
    expect(text(el, '[data-cy=auth-title]')).to.equal('log in');
    expect(text(el, '[part~=description]')).to.equal("choose how you'd like to continue");
    expect(text(el, '[part~=divider] em')).to.equal('or');
    expect(text(el, '[data-cy=pipe-submit]')).to.equal('log in');
    expect(text(el, '[data-cy=pipe-email-otp]')).to.equal('email me a code');
    expect(text(el, '[data-cy=pipe-mobile-otp]')).to.equal('text me a code');
    expect(text(el, '[part~=console-foot]')).to.contain('new here?');
    expect(text(el, '[data-cy=signup-link]')).to.equal('get started');
  });

  it('mirrors the register on the signup flow', async () => {
    const el = await console_(['email_password', 'google'], {flow: 'signup'});
    expect(text(el, '[data-cy=auth-title]')).to.equal('sign up');
    expect(text(el, '[data-cy=pipe-submit]')).to.equal('sign up');
    expect(text(el, '[part~=console-foot]')).to.contain('already have an account?');
    expect(text(el, '[data-cy=login-link]')).to.equal('log in');
  });

  it('names the authentik provider SSO rather than the product behind it', async () => {
    const el = await console_(['email_password', 'authentik']);
    expect(text(el, '[data-cy=sso-provider-link]')).to.contain('Continue with SSO');
  });

  it('shows an OTP-only host its code pipe inline instead of only a link', async () => {
    const el = await console_(['email_otp', 'google']);
    expect(q(el, '[data-cy=pipe-form-email_otp]'), 'code pipe rendered inline').to.exist;
    expect(q(el, '[data-cy=pipe-email-otp]'), 'not also offered as a link').to.not.exist;
    expect(text(el, '[data-cy=pipe-submit]')).to.equal('send code');
  });

  it('focuses the first social button when a modal opens, never the close control', async () => {
    const el = await fixture<NoizuAuth>(
      html`<noizu-auth mode="modal" open transport="rest" api-base="/api/v1" .pipes=${['email_password', 'google', 'authentik'] as never}></noizu-auth>`,
    );
    await settle(el);
    const active = el.shadowRoot!.activeElement as HTMLElement;
    expect(active?.getAttribute('data-provider')).to.equal('google');
    expect(active?.getAttribute('part') ?? '').to.not.contain('close');
  });

  it('falls back to the first field when there is no social pipe to focus', async () => {
    const el = await fixture<NoizuAuth>(
      html`<noizu-auth mode="modal" open transport="rest" api-base="/api/v1" .pipes=${['email_password'] as never}></noizu-auth>`,
    );
    await settle(el);
    expect(el.shadowRoot!.activeElement).to.equal(q(el, '[name=email]'));
  });

  it('draws the legacy options flow in the console arrangement too', async () => {
    const el = await fixture<NoizuAuth>(
      html`<noizu-auth transport="rest" api-base="/api/v1"></noizu-auth>`,
    );
    await settle(el);
    const order = all(el, '[part~=providers],[part~=divider],[part~=form],[part~=console-foot]')
      .map((node) => node.getAttribute('part')!.split(' ')[0]);
    expect(order).to.deep.equal(['providers', 'divider', 'form', 'console-foot']);
    expect(all(el, '[part~=sso-button]')).to.have.length(3);
  });

  it('keeps the rule between a social row and an OTP-only form', async () => {
    const el = await console_(['email_otp', 'mobile_otp', 'google']);
    const order = all(el, '[part~=providers],[part~=divider],[part~=form],[part~=otp-links]')
      .map((node) => node.getAttribute('part')!.split(' ')[0]);
    expect(order).to.deep.equal(['providers', 'divider', 'form', 'otp-links']);
    // The second code pipe stays a link, and carries no leading separator.
    const links = all(el, '[part~=otp-link]');
    expect(links).to.have.length(1);
    expect(text(el, '[part~=otp-links]')).to.equal('text me a code');
  });
});
