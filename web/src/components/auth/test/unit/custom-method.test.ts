import {expect, fixture, html, fixtureCleanup, oneEvent} from '@open-wc/testing';
import {NoizuAuth} from '../../noizu-auth.js';

/**
 * Custom-method mode (`custom-method` / `pipes = ['custom']`).
 *
 * The contract these pin: the kit keeps its card chrome and modal behaviour,
 * renders only host-slotted method content, and never touches the network —
 * the host (therobot.institute's Ed25519 key sign-in, for one) owns the whole
 * credential exchange and reports the outcome through `complete()` / `fail()`.
 */

const nativeFetch = globalThis.fetch;
const NativeWebSocket = globalThis.WebSocket;
let fetchCalls: string[] = [];
let socketCalls: string[] = [];

function trapNetwork() {
  fetchCalls = [];
  socketCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(typeof input === 'string' || input instanceof URL ? input : input.url));
    return new Response('{}', {status: 200, headers: {'content-type': 'application/json'}});
  }) as typeof fetch;
  globalThis.WebSocket = class {
    constructor(url: string) {
      socketCalls.push(url);
      throw new Error('custom-method mode must not open a socket');
    }
  } as unknown as typeof WebSocket;
}

const settle = async (el: NoizuAuth) => {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

const q = (el: NoizuAuth, selector: string) => el.shadowRoot!.querySelector(selector);
const assignedPane = (el: NoizuAuth) => {
  const slot = q(el, '[part~=method] slot') as HTMLSlotElement;
  return slot.assignedElements({flatten: true}).map((node) => node.id);
};

async function customModal(attrs: {flow?: 'login' | 'signup'; transport?: string} = {}) {
  const el = await fixture<NoizuAuth>(html`<noizu-auth
    mode="modal"
    custom-method
    flow=${attrs.flow ?? 'login'}
    transport=${attrs.transport ?? 'rest'}
    .text=${{loginTitle: 'sign in with your key', signupTitle: 'join the institute'}}
  >
    <strong slot="brand">therobot.institute</strong>
    <div slot="method-login" id="login-pane"><button id="sign-with-key" type="button">sign with key</button></div>
    <div slot="method-register" id="register-pane"><button id="make-key" type="button">generate a key</button></div>
  </noizu-auth>`);
  await settle(el);
  return el;
}

describe('noizu-auth custom-method mode', () => {
  beforeEach(trapNetwork);
  afterEach(() => {
    fixtureCleanup();
    globalThis.fetch = nativeFetch;
    globalThis.WebSocket = NativeWebSocket;
  });

  it('renders the host pane inside the card chrome and none of the built-in pipe UI', async () => {
    const el = await customModal();
    el.open = true;
    await settle(el);

    expect((q(el, 'dialog') as HTMLDialogElement).open, 'modal opened').to.equal(true);
    expect(q(el, '[data-cy=auth-title]')!.textContent!.trim()).to.equal('sign in with your key');
    expect(q(el, 'slot[name=brand]'), 'brand slot kept').to.exist;
    expect(q(el, 'slot[name=footer]'), 'footer slot kept').to.exist;
    expect(q(el, '[part~=close]'), 'close × kept').to.exist;
    expect(assignedPane(el)).to.deep.equal(['login-pane']);
    for (const selector of ['input', 'form', '[data-cy=email-input]', '[data-cy=pipe-list]', '[part~=providers]', '[part~=segments]', 'noizu-phone-input', 'noizu-human-verify']) {
      expect(q(el, selector), `${selector} absent`).to.not.exist;
    }
  });

  it('makes no network request on either transport', async () => {
    const rest = await customModal({transport: 'rest'});
    rest.open = true;
    await settle(rest);
    fixtureCleanup();
    // The socket transport is the default when `transport` is unset.
    const socket = await fixture<NoizuAuth>(html`<noizu-auth mode="modal" custom-method open><div slot="method"></div></noizu-auth>`);
    await settle(socket);
    // `pipes = ['custom']` is the same switch.
    const viaPipes = await fixture<NoizuAuth>(html`<noizu-auth transport="rest" .pipes=${['custom'] as never}><div slot="method"></div></noizu-auth>`);
    await settle(viaPipes);

    expect(fetchCalls, 'no fetch').to.deep.equal([]);
    expect(socketCalls, 'no WebSocket').to.deep.equal([]);
    expect(q(viaPipes, '[data-cy=custom-method]'), 'pipes=[custom] renders the slot').to.exist;
  });

  it('loads discovery once it leaves custom mode, whichever switch turned it off', async () => {
    const viaPipes = await fixture<NoizuAuth>(html`<noizu-auth transport="rest" .pipes=${['custom'] as never}></noizu-auth>`);
    await settle(viaPipes);
    expect(fetchCalls).to.deep.equal([]);
    viaPipes.pipes = ['email_password'];
    await settle(viaPipes);
    expect(fetchCalls.filter((url) => url.includes('/auth/config')), 'pipes path').to.have.length(1);

    fetchCalls = [];
    const viaAttr = await fixture<NoizuAuth>(html`<noizu-auth transport="rest" custom-method></noizu-auth>`);
    await settle(viaAttr);
    expect(fetchCalls).to.deep.equal([]);
    viaAttr.customMethod = false;
    await settle(viaAttr);
    expect(fetchCalls.filter((url) => url.includes('/auth/config')), 'attribute path').to.have.length(1);
  });

  it('switches the slotted pane with `flow`, falling back to `method`', async () => {
    const el = await customModal();
    expect(assignedPane(el)).to.deep.equal(['login-pane']);

    el.flow = 'signup';
    await settle(el);
    expect(assignedPane(el)).to.deep.equal(['register-pane']);
    expect(q(el, '[data-cy=auth-title]')!.textContent!.trim()).to.equal('join the institute');

    fixtureCleanup();
    const shared = await fixture<NoizuAuth>(html`<noizu-auth custom-method flow="signup"><div slot="method" id="shared"></div></noizu-auth>`);
    await settle(shared);
    expect(assignedPane(shared)).to.deep.equal(['shared']);
  });

  it('switches flow when slotted content dispatches auth-flow-switch', async () => {
    const el = await customModal();
    const button = el.querySelector('#sign-with-key')!;
    const changed = oneEvent(el, 'noizu-auth-flow-change');
    button.dispatchEvent(new CustomEvent('auth-flow-switch', {detail: {flow: 'register'}, bubbles: true, composed: true}));
    const {detail} = await changed;
    await settle(el);

    expect(el.flow).to.equal('signup');
    expect(detail).to.deep.equal({flow: 'signup'});
    expect(assignedPane(el)).to.deep.equal(['register-pane']);
  });

  it('complete() fires auth-success with the host detail and closes the modal', async () => {
    const el = await customModal();
    el.open = true;
    await settle(el);
    const events: string[] = [];
    el.addEventListener('auth-close', () => events.push('auth-close'));
    const success = oneEvent(el, 'auth-success');

    el.complete({publicKey: 'ed25519:abc', entityId: 'e-1'});
    const {detail} = await success;
    await settle(el);

    expect(detail).to.deep.equal({publicKey: 'ed25519:abc', entityId: 'e-1'});
    expect(el.open).to.equal(false);
    expect((q(el, 'dialog') as HTMLDialogElement).open).to.equal(false);
    expect(events).to.deep.equal(['auth-close']);
  });

  it('fail() fires auth-error and shows the message without closing', async () => {
    const el = await customModal();
    el.open = true;
    await settle(el);
    const failed = oneEvent(el, 'auth-error');

    el.fail({message: 'signature did not verify', code: 'bad_signature'});
    const {detail} = await failed;
    await settle(el);

    expect(detail).to.deep.equal({message: 'signature did not verify', code: 'bad_signature'});
    expect(q(el, '[data-cy=auth-error]')!.textContent).to.equal('signature did not verify');
    expect(el.open).to.equal(true);
  });

  it('Escape closes the dialog and fires auth-close', async () => {
    const el = await customModal();
    el.open = true;
    await settle(el);
    const closed = oneEvent(el, 'auth-close');
    const dialog = q(el, 'dialog') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', {cancelable: true}));
    await closed;
    await settle(el);

    expect(el.open).to.equal(false);
    expect(dialog.open).to.equal(false);
  });

  it('focuses the first control in the slotted pane when the modal opens', async () => {
    const el = await customModal();
    el.open = true;
    await settle(el);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement?.id).to.equal('sign-with-key');
  });
});
