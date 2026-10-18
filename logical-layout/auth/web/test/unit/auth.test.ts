import {expect, fixture, html, fixtureCleanup} from '@open-wc/testing';
import {NoizuAuth} from '../../noizu-auth.js';
import {AuthSocket, authSocketUrl} from '../../transport.js';

class Socket extends EventTarget {
  static OPEN = 1; static CONNECTING = 0; static instances: Socket[] = [];
  readyState = 0; messages: any[] = [];
  constructor(readonly url: string) {super(); Socket.instances.push(this); queueMicrotask(() => {this.readyState = 1; this.dispatchEvent(new Event('open'));});}
  send(data: string) {const request = JSON.parse(data); this.messages.push(request); if (request.method === 'config') this.reply(request.id, {providers: [{id:'oidc',href:'/auth/oidc'},{id:'authentik',href:'/auth/authentik'},{id:'google',href:'/auth/google'},{id:'github',href:'/auth/github'}],domains:{'company.test':['oidc'],'noizu.com':['authentik'],'therobotlives.com':['google'],'therobot.is':['github']}});}
  reply(id: string, result: unknown) {this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id,result})}));}
  fail(id: string, error: {code?: string; message: string}) {this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id,error})}));}
  close() {this.readyState = 3; this.dispatchEvent(new Event('close'));}
}
const settle = async (el: NoizuAuth) => {await el.updateComplete; await new Promise(r => setTimeout(r,0)); await el.updateComplete;};
const fill = (el: NoizuAuth, name: string, value: string) => {const input = el.shadowRoot!.querySelector<HTMLInputElement>(`[name=${name}]`)!; input.value=value; input.dispatchEvent(new Event('input'));};
const discover = async (el: NoizuAuth, email = 'me@test.com') => {fill(el,'email',email);submit(el);await settle(el);};
const submit = (el: NoizuAuth) => el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
describe('standard auth', () => {
  const native = globalThis.WebSocket;
  beforeEach(() => {Socket.instances=[]; globalThis.WebSocket=Socket as unknown as typeof WebSocket;});
  afterEach(() => {fixtureCleanup(); globalThis.WebSocket=native;});
  it('enforces same host and explicit development port', () => {
    const page = new URL('https://example.test/signin') as unknown as Location;
    expect(authSocketUrl('/auth/socket',false,undefined,page)).to.equal('wss://example.test/auth/socket');
    expect(authSocketUrl('/auth/socket',true,4000,page)).to.equal('wss://example.test:4000/auth/socket');
    for (const endpoint of ['https://evil.test','//evil.test','/\\evil.test']) expect(() => authSocketUrl(endpoint,false,undefined,page)).to.throw();
    expect(() => authSocketUrl('/auth/socket',false,4000,page)).to.throw();
  });
  it('correlates out of order replies and rejects disconnects', async () => {
    const client = new AuthSocket('ws://localhost/auth/socket');
    const one=client.request('one'), two=client.request('two'); await new Promise(r=>setTimeout(r,0));
    const socket=Socket.instances[0]; socket.reply('2',{n:2});socket.reply('1',{n:1});
    expect(await one).to.deep.equal({n:1});expect(await two).to.deep.equal({n:2});
    const pending=client.request('three').catch(e=>e.message);client.close();expect(await pending).to.include('closed');
  });
  it('times out a request without leaking it into later replies', async () => {
    const client=new AuthSocket('ws://localhost/auth/socket',5);const error=await client.request('never').catch(e=>e.message);expect(error).to.include('timed out');client.close();
  });
  it('filters methods/providers and applies copy and avatar alt overrides', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .options=${{password:true,magicLink:false,otp:false,providers:[]}} .text=${{loginTitle:'Hello'}} .avatar=${{src:'/robot.png',alt:'Robot companion'}}></noizu-auth>`);await settle(el);
    expect(el.shadowRoot!.querySelector('h1')!.textContent).to.equal('Hello');expect(el.shadowRoot!.querySelector('img')!.alt).to.equal('Robot companion');
    expect(el.shadowRoot!.querySelectorAll('[part=method]')).to.have.length(0);expect(el.shadowRoot!.querySelectorAll('[part=provider]')).to.have.length(0);
  });
  it('routes matching signup email to SSO without password fallback', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth flow="signup"></noizu-auth>`);await settle(el);fill(el,'email','me@company.test');submit(el);await settle(el);
    expect(el.shadowRoot!.querySelector('[data-provider=oidc]')).to.exist;
    expect(el.shadowRoot!.querySelector('[name=password]')).not.to.exist;
    expect(el.shadowRoot!.querySelector('form')).not.to.exist;
  });
  it('submits login once and emits no credentials from success payload', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth></noizu-auth>`);await settle(el);await discover(el);fill(el,'password','secret123');
    let detail: unknown;el.addEventListener('auth-success',(event)=>{detail=(event as CustomEvent).detail;});submit(el);submit(el);await settle(el);
    const socket=Socket.instances[0],requests=socket.messages.filter(m=>m.method==='login');expect(requests).to.have.length(1);expect(requests[0].params).to.deep.equal({email:'me@test.com',password:'secret123'});
    socket.reply(requests[0].id,{authenticated:true,user:{password:'never expose'},access_token:'never expose'});await settle(el);expect(detail).to.deep.equal({});
    expect(el.shadowRoot!.querySelector<HTMLInputElement>('[name=password]')!.value).to.equal('');
  });
  it('recovers controls after endpoint changes during a request', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth></noizu-auth>`);await settle(el);await discover(el);fill(el,'password','secret123');submit(el);await settle(el);el.endpoint='/other/socket';await settle(el);expect(el.shadowRoot!.querySelector('fieldset')!.disabled).to.equal(false);
  });
  it('uses a native modal and restores focus on Escape', async () => {
    const opener=document.createElement('button');document.body.append(opener);opener.focus();
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="modal" open></noizu-auth>`);await settle(el);const dialog=el.shadowRoot!.querySelector('dialog')!;expect(dialog.open).to.equal(true);
    dialog.dispatchEvent(new Event('cancel',{cancelable:true}));await settle(el);expect(dialog.open).to.equal(false);expect(document.activeElement).to.equal(opener);opener.remove();
  });
  it('registers profile with a top-level invitation', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth flow="signup"></noizu-auth>`);await settle(el);fill(el,'email','me@test.com');submit(el);await settle(el);
    for (const [name,value] of Object.entries({user_name:'robot',first_name:'The',last_name:'Robot',mobile_phone:'123456789',password:'secret123',invite_token:'invite123'})) fill(el,name,value);
    submit(el);await settle(el);const socket=Socket.instances[0],request=socket.messages.find(m=>m.method==='register');
    expect(request.params.invite_token).to.equal('invite123');expect(request.params.user).to.deep.equal({email:'me@test.com',user_name:'robot',first_name:'The',last_name:'Robot',mobile_phone:'123456789',password:'secret123'});
    socket.reply(request.id,{status:'pending'});await settle(el);expect(el.shadowRoot!.querySelector('[role=status]')!.textContent).to.include('creating your account');
  });
  it('offers email sign-in codes only when explicitly enabled', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth></noizu-auth>`);await settle(el);
    el.options={password:true,otp:true};await discover(el);
    // Console arrangement: the active method is the inline form, so only the *other*
    // methods render, as text links under the primary button.
    const methods=el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part=method]');
    expect(Array.from(methods, button=>button.textContent)).to.deep.equal(['Email me a sign-in code']);
    methods[0].click();await settle(el);fill(el,'email','me@test.com');
    expect(el.shadowRoot!.querySelector('[type=submit]')!.textContent).to.equal('send code');
    submit(el);await settle(el);const socket=Socket.instances[0],request=socket.messages.find(m=>m.method==='otp-request');socket.reply(request.id,{});await settle(el);
    fill(el,'code','123456');submit(el);await settle(el);const verify=socket.messages.find(m=>m.method==='otp-verify');expect(verify.params).to.deep.equal({email:'me@test.com',code:'123456'});socket.reply(verify.id,{authenticated:true});await settle(el);
    expect(socket.messages.some(m=>m.method==='magic-link')).to.equal(false);
  });
  it('supports email links when explicitly enabled', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .options=${{password:true,magicLink:true,otp:false}}></noizu-auth>`);await settle(el);await discover(el);
    const methods=el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part=method]');
    expect(Array.from(methods, button=>button.textContent)).to.deep.equal(['Email link']);
    methods[0].click();await settle(el);fill(el,'email','me@test.com');submit(el);await settle(el);
    const socket=Socket.instances[0],link=socket.messages.find(m=>m.method==='magic-link');socket.reply(link.id,{});await settle(el);expect(el.shadowRoot!.querySelector('[role=status]')!.textContent).to.include('sign-in link');
  });
  it('starts login with email only then defaults unmatched emails to password', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth></noizu-auth>`);await settle(el);
    expect(el.shadowRoot!.querySelector('[name=password]')).not.to.exist;
    // Console arrangement: the configured providers are the social grid above the form,
    // from the first step — not something only a domain policy can reveal.
    expect(el.shadowRoot!.querySelectorAll('[part~=provider]')).to.have.length(4);
    await discover(el);
    expect(el.shadowRoot!.querySelector('[name=password]')).to.exist;
    expect(el.shadowRoot!.querySelectorAll('[part=method]')).to.have.length(0);
    expect(Socket.instances[0].messages.filter(m=>m.method==='config').at(-1).params).to.deep.equal({email:'me@test.com'});
    expect(el.shadowRoot!.querySelector<HTMLInputElement>('[name=email]')!.readOnly).to.equal(true);
  });
  it('matches domains exactly and case-insensitively, and supports changing email', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth></noizu-auth>`);await settle(el);
    await discover(el,'Me@COMPANY.TEST');
    // A mapped domain still routes exclusively: only its provider, no credential form.
    expect(Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part~=provider]'), b=>b.dataset.provider)).to.deep.equal(['oidc']);
    expect(el.shadowRoot!.querySelector('[name=password]')).not.to.exist;
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="back button"]')!.click();await settle(el);
    await discover(el,'me@evilcompany.test');
    // An unmapped domain falls back to the console: the full social grid plus the form.
    expect(el.shadowRoot!.querySelectorAll('[part~=provider]')).to.have.length(4);
    expect(el.shadowRoot!.querySelector('[name=password]')).to.exist;
  });
  it('routes each configured domain to its own provider', async () => {
    for (const [domain,provider] of Object.entries({'noizu.com':'authentik','therobotlives.com':'google','therobot.is':'github'})) {
      const el=await fixture<NoizuAuth>(html`<noizu-auth></noizu-auth>`);await settle(el);await discover(el,'me@'+domain);
      expect(el.shadowRoot!.querySelectorAll('[part~=provider]')).to.have.length(1);
      expect(el.shadowRoot!.querySelector('[data-provider='+provider+']')).to.exist;
      expect(el.shadowRoot!.querySelector('[name=password]')).not.to.exist;
    }
  });
  it('does not fall back to password when a mapped provider is hidden', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .options=${{password:true,providers:[]}}></noizu-auth>`);await settle(el);await discover(el,'me@noizu.com');
    expect(el.shadowRoot!.querySelector('[name=password]')).not.to.exist;
    expect(el.shadowRoot!.textContent).to.include('No sign-in methods are available.');
  });
  it('dismisses pending modal login without completing stale work', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="modal" open></noizu-auth>`);await settle(el);await discover(el);fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0],request=socket.messages.find(m=>m.method==='login');let success=false;el.addEventListener('auth-success',()=>{success=true;});
    el.open=false;await settle(el);socket.reply(request.id,{authenticated:true});await settle(el);
    expect(success).to.equal(false);expect(socket.readyState).to.equal(3);expect(el.shadowRoot!.querySelector<HTMLInputElement>('[name=password]')!.value).to.equal('');
  });

});

describe('seven-pipe flow (data-driven)', () => {
  const native = globalThis.WebSocket;
  beforeEach(() => {Socket.instances=[]; globalThis.WebSocket=Socket as unknown as typeof WebSocket;});
  afterEach(() => {fixtureCleanup(); globalThis.WebSocket=native;});

  it('leaves the legacy flow untouched when pipes is unset', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth></noizu-auth>`);await settle(el);
    expect(el.shadowRoot!.querySelectorAll('[part=pipe]')).to.have.length(0);
  });

  it('renders only the enabled pipes, in canonical order, data-driven (layout=tabs)', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth layout="tabs" .pipes=${['authentik','email_password','mobile_otp']}></noizu-auth>`);await settle(el);
    const buttons=el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part=pipe]');
    expect(Array.from(buttons, b=>b.dataset.cy)).to.deep.equal(['pipe-email-password','pipe-mobile-otp','pipe-authentik']);
  });

  it('renders the github pipe last in canonical order with the GitHub label (layout=tabs)', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth layout="tabs" .pipes=${['github','email_password','google','authentik']}></noizu-auth>`);await settle(el);
    const buttons=el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part=pipe]');
    expect(Array.from(buttons, b=>b.dataset.cy)).to.deep.equal(['pipe-email-password','pipe-google','pipe-authentik','pipe-github']);
    expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy=pipe-github]')!.textContent).to.include('Continue with GitHub');
  });

  it('offers the GitHub provider link when a merge challenge names the github pipe', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['email_password']}></noizu-auth>`);await settle(el);
    fill(el,'email','me@test.com');fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0],req=socket.messages.find(m=>m.method==='login');
    socket.reply(req.id,{merge_required:true,challenge_id:'chal-gh',pipes:[{type:'github',masked:'***'}]});await settle(el);
    const option=el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy=merge-pipe-option]')!;
    expect(option.dataset.pipeType).to.equal('github');
    option.click();await settle(el);
    expect(el.shadowRoot!.querySelector('[data-cy=sso-provider-link]')).to.exist;
  });

  it('submits the mobile_password pipe with an E.164 identifier', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['mobile_password']}></noizu-auth>`);await settle(el);
    const phone=el.shadowRoot!.querySelector('noizu-phone-input') as any;
    phone.value='+15551234567';phone.dispatchEvent(new CustomEvent('phone-change',{detail:{value:'+15551234567'}}));
    fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0],request=socket.messages.find(m=>m.method==='login');
    expect(request.params).to.deep.equal({mobile_phone:'+15551234567',password:'secret123'});
  });

  it('requests then verifies an email_otp code and emits noizu-auth-otp-requested', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['email_otp']}></noizu-auth>`);await settle(el);
    let requested: unknown; el.addEventListener('noizu-auth-otp-requested', (e)=>{requested=(e as CustomEvent).detail;});
    fill(el,'email','me@test.com');submit(el);await settle(el);
    const socket=Socket.instances[0],req=socket.messages.find(m=>m.method==='otp-request');socket.reply(req.id,{});await settle(el);
    expect(requested).to.deep.equal({pipe:'email_otp'});
    fill(el,'code','654321');submit(el);await settle(el);
    const verify=socket.messages.find(m=>m.method==='otp-verify');expect(verify.params).to.deep.equal({email:'me@test.com',code:'654321'});
  });

  it('emits noizu-auth-submit and noizu-auth-success alongside legacy auth-success', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['email_password']}></noizu-auth>`);await settle(el);
    let submitted: unknown, success = false, newSuccess = false;
    el.addEventListener('noizu-auth-submit',(e)=>{submitted=(e as CustomEvent).detail;});
    el.addEventListener('auth-success',()=>{success=true;});
    el.addEventListener('noizu-auth-success',()=>{newSuccess=true;});
    fill(el,'email','me@test.com');fill(el,'password','secret123');submit(el);await settle(el);
    expect(submitted).to.deep.equal({pipe:'email_password',flow:'login'});
    const socket=Socket.instances[0],req=socket.messages.find(m=>m.method==='login');socket.reply(req.id,{authenticated:true});await settle(el);
    expect(success).to.equal(true);expect(newSuccess).to.equal(true);
  });

  it('walks merge_required -> merge_confirming -> merge_confirmed with masked identifiers only', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['email_password']}></noizu-auth>`);await settle(el);
    let mergeRequired: any, mergeConfirmed: any;
    el.addEventListener('noizu-auth-merge-required',(e)=>{mergeRequired=(e as CustomEvent).detail;});
    el.addEventListener('noizu-auth-merge-confirmed',(e)=>{mergeConfirmed=(e as CustomEvent).detail;});
    fill(el,'email','me@test.com');fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0],req=socket.messages.find(m=>m.method==='login');
    socket.reply(req.id,{merge_required:true,challenge_id:'chal-1',pipes:[{type:'email_password',masked:'m****@test.com'}]});await settle(el);
    expect(mergeRequired).to.deep.equal({challengeId:'chal-1',pipes:[{type:'email_password',masked:'m****@test.com'}]});
    expect(el.shadowRoot!.textContent).to.include('m****@test.com');
    const option=el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy=merge-pipe-option]')!;
    expect(option.dataset.pipeType).to.equal('email_password');
    option.click();await settle(el);
    fill(el,'email','me@test.com');fill(el,'password','secret123');
    el.shadowRoot!.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle(el);
    const confirm=socket.messages.filter(m=>m.method==='login').at(-1);
    expect(confirm.params.merge_challenge_id).to.equal('chal-1');
    socket.reply(confirm.id,{merge_confirmed:true});await settle(el);
    expect(mergeConfirmed).to.deep.equal({challengeId:'chal-1'});
  });
});

describe('invite-token-mode (signup)', () => {
  const native = globalThis.WebSocket;
  beforeEach(() => {Socket.instances=[]; globalThis.WebSocket=Socket as unknown as typeof WebSocket;});
  afterEach(() => {fixtureCleanup(); globalThis.WebSocket=native;});
  const mount = async (mode?: string) => {
    const el = await fixture<NoizuAuth>(mode ? html`<noizu-auth flow="signup" invite-token-mode=${mode}></noizu-auth>` : html`<noizu-auth flow="signup"></noizu-auth>`);
    await settle(el); fill(el,'email','me@test.com'); submit(el); await settle(el); return el;
  };
  const fillProfile = (el: NoizuAuth) => {for (const [name,value] of Object.entries({user_name:'robot',first_name:'The',last_name:'Robot',mobile_phone:'123456789',password:'secret123'})) fill(el,name,value);};

  it('renders a non-required field by default', async () => {
    const el=await mount();
    expect(el.shadowRoot!.querySelector<HTMLInputElement>('[name=invite_token]')!.required).to.equal(false);
    expect(el.shadowRoot!.querySelector('label[for=invite_token]')!.textContent).to.equal('Invite token (optional)');
  });

  it('marks the field required, blocks blank submits with the inviteRequired copy, and round-trips a filled token', async () => {
    const el=await mount('required');
    expect(el.shadowRoot!.querySelector<HTMLInputElement>('[name=invite_token]')!.required).to.equal(true);
    fillProfile(el);
    // Empty: native validity (the required flag) blocks before the client-side gate.
    submit(el);await settle(el);
    expect(Socket.instances[0].messages.some(m=>m.method==='register')).to.equal(false);
    // Whitespace-only satisfies native required but is caught by the client-side gate.
    fill(el,'invite_token','   ');submit(el);await settle(el);
    expect(Socket.instances[0].messages.some(m=>m.method==='register')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[role=alert]')!.textContent).to.include('Invite token is required');
    fill(el,'invite_token','invite123');submit(el);await settle(el);
    const request=Socket.instances[0].messages.find(m=>m.method==='register')!;
    expect(request.params.invite_token).to.equal('invite123');
  });

  it('omits the field and the submit param when hidden', async () => {
    const el=await mount('hidden');
    expect(el.shadowRoot!.querySelector('[name=invite_token]')).not.to.exist;
    fillProfile(el);submit(el);await settle(el);
    const request=Socket.instances[0].messages.find(m=>m.method==='register')!;
    expect('invite_token' in JSON.parse(JSON.stringify(request.params))).to.equal(false);
    expect('invite_token' in JSON.parse(JSON.stringify(request.params.user))).to.equal(false);
  });

  it('blocks blank submits in required mode on the pipes flow too', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth flow="signup" invite-token-mode="required" .pipes=${['email_password']}></noizu-auth>`);await settle(el);
    fill(el,'email','me@test.com');fill(el,'user_name','robot');fill(el,'first_name','The');fill(el,'last_name','Robot');fill(el,'password','secret123');fill(el,'invite_token','   ');
    submit(el);await settle(el);
    expect(Socket.instances[0].messages.some(m=>m.method==='register')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[role=alert]')!.textContent).to.include('Invite token is required');
  });

  it('resolves an invalid attribute value to optional while preserving the attribute', async () => {
    const el=await mount('bogus');
    expect(el.inviteTokenMode).to.equal('bogus');
    expect(el.getAttribute('invite-token-mode')).to.equal('bogus');
    expect(el.shadowRoot!.querySelector<HTMLInputElement>('[name=invite_token]')!.required).to.equal(false);
    expect(el.shadowRoot!.querySelector('label[for=invite_token]')!.textContent).to.equal('Invite token (optional)');
  });

  it('derives the required-mode label and lets text.invite override it in both modes', async () => {
    const required=await mount('required');
    expect(required.shadowRoot!.querySelector('label[for=invite_token]')!.textContent).to.equal('Invite token (required)');
    for (const mode of ['optional','required']) {
      const el=await fixture<NoizuAuth>(html`<noizu-auth flow="signup" invite-token-mode=${mode} .text=${{invite: 'Access code'}}></noizu-auth>`);await settle(el);
      fill(el,'email','me@test.com');submit(el);await settle(el);
      expect(el.shadowRoot!.querySelector('label[for=invite_token]')!.textContent).to.equal('Access code');
    }
  });
});

describe('invite-fallback-url (signup)', () => {
  const native = globalThis.WebSocket;
  // `location.assign` is unforgeable in Chrome, so the harness subclass overrides the
  // component's navigateTo() seam and records the target instead of really navigating.
  class FallbackHarness extends NoizuAuth {
    static navigated: string[] = [];
    protected override navigateTo(url: string) {FallbackHarness.navigated.push(url);}
  }
  customElements.define('noizu-auth-fallback-test', FallbackHarness);
  const navigated = () => FallbackHarness.navigated;
  beforeEach(() => {Socket.instances=[]; globalThis.WebSocket=Socket as unknown as typeof WebSocket; FallbackHarness.navigated=[];});
  afterEach(() => {fixtureCleanup(); globalThis.WebSocket=native;});
  // Legacy signup form: email discovery, then profile + password + invite token.
  const mount = async (fallback = '', pipes?: string[]) => {
    const el = await fixture<FallbackHarness>(html`<noizu-auth-fallback-test flow="signup" invite-token-mode="required" invite-fallback-url=${fallback} .pipes=${pipes}></noizu-auth-fallback-test>`);
    await settle(el); fill(el,'email','me@test.com'); submit(el); await settle(el);
    const fields: Record<string,string> = pipes ? {user_name:'robot',first_name:'The',last_name:'Robot',password:'secret123',invite_token:'stale-token'} : {user_name:'robot',first_name:'The',last_name:'Robot',mobile_phone:'123456789',password:'secret123',invite_token:'stale-token'};
    for (const [name,value] of Object.entries(fields)) fill(el,name,value);
    submit(el); await settle(el); return el;
  };
  const rejectRegister = async (el: NoizuAuth, error: {code?: string; message: string}) => {
    const request = Socket.instances[0].messages.find(m=>m.method==='register')!;
    Socket.instances[0].fail(request.id, error); await settle(el);
  };

  it('navigates to the fallback URL on an invite rejection, after surfacing the error state and event', async () => {
    const el = await mount('/waitlist');
    let detail: unknown; el.addEventListener('auth-error',(e)=>{detail=(e as CustomEvent).detail;});
    await rejectRegister(el, {code:'invalid_invite_token', message:'Invalid invite token.'});
    expect(detail).to.deep.equal({message:'Invalid invite token.'});
    expect(el.shadowRoot!.querySelector('[role=alert]')!.textContent).to.include('Invalid invite token.');
    expect(el.shadowRoot!.querySelector('[role=status]')!.textContent).to.include('signup page');
    expect(navigated()).to.deep.equal(['/waitlist']);
  });

  it('matches the rejection case-insensitively from the message alone (no machine code)', async () => {
    const el = await mount('/waitlist');
    await rejectRegister(el, {message:'Server says: INVALID_INVITE_TOKEN'});
    expect(navigated()).to.deep.equal(['/waitlist']);
  });

  it('never navigates without the attribute (byte-identical legacy behaviour)', async () => {
    const el = await mount();
    await rejectRegister(el, {code:'invalid_invite_token', message:'Invalid invite token.'});
    expect(navigated()).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('[role=alert]')!.textContent).to.include('Invalid invite token.');
  });

  it('never navigates for irrelevant register errors', async () => {
    const el = await mount('/waitlist');
    await rejectRegister(el, {code:'email_taken', message:'That email is already registered.'});
    expect(navigated()).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('[role=alert]')!.textContent).to.include('already registered');
  });

  it('never navigates when the resolved invite mode is not required', async () => {
    const el = await fixture<FallbackHarness>(html`<noizu-auth-fallback-test flow="signup" invite-fallback-url="/waitlist"></noizu-auth-fallback-test>`);
    await settle(el); fill(el,'email','me@test.com'); submit(el); await settle(el);
    for (const [name,value] of Object.entries({user_name:'robot',first_name:'The',last_name:'Robot',mobile_phone:'123456789',password:'secret123',invite_token:'stale-token'})) fill(el,name,value);
    submit(el); await settle(el);
    await rejectRegister(el, {code:'invalid_invite_token', message:'Invalid invite token.'});
    expect(navigated()).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector('[role=alert]')!.textContent).to.include('Invalid invite token.');
  });

  it('navigates from the pipes flow too', async () => {
    const el = await mount('/waitlist', ['email_password']);
    await rejectRegister(el, {code:'invalid_invite_token', message:'Invalid invite token.'});
    expect((el as unknown as {pipeState: string}).pipeState).to.equal('error');
    expect(navigated()).to.deep.equal(['/waitlist']);
  });
});

describe('invite interstitial (explicit invite-token-mode="optional")', () => {
  const native = globalThis.WebSocket;
  class GateHarness extends NoizuAuth {
    static navigated: string[] = [];
    protected override navigateTo(url: string) {GateHarness.navigated.push(url);}
  }
  customElements.define('noizu-auth-invite-gate-test', GateHarness);
  const navigated = () => GateHarness.navigated;
  beforeEach(() => {Socket.instances=[]; globalThis.WebSocket=Socket as unknown as typeof WebSocket; GateHarness.navigated=[];});
  afterEach(() => {fixtureCleanup(); globalThis.WebSocket=native;});
  const legacyFields = {user_name:'robot',first_name:'The',last_name:'Robot',mobile_phone:'123456789',password:'secret123'};
  const pipeFields = {user_name:'robot',first_name:'The',last_name:'Robot',password:'secret123'};
  // `mode` undefined = attribute absent (the legacy default); `url` undefined = attribute absent.
  const mount = async (opts: {mode?: string; url?: string; pipes?: string[]} = {mode: 'optional'}) => {
    const el = await fixture<GateHarness>(html`<noizu-auth-invite-gate-test flow="signup" .pipes=${opts.pipes}></noizu-auth-invite-gate-test>`);
    if (opts.mode !== undefined) el.setAttribute('invite-token-mode', opts.mode);
    if (opts.url !== undefined) el.setAttribute('invite-required-url', opts.url);
    await settle(el);
    if (!opts.pipes) {fill(el,'email','me@test.com'); submit(el); await settle(el);} else fill(el,'email','me@test.com');
    for (const [name,value] of Object.entries(opts.pipes ? pipeFields : legacyFields)) fill(el,name,value);
    return el;
  };
  const register = async (el: NoizuAuth, outcome: {result?: unknown; error?: {code?: string; message: string}}) => {
    submit(el); await settle(el);
    const request = Socket.instances[0].messages.find(m=>m.method==='register')!;
    expect(request, 'register sent').to.exist;
    if (outcome.error) Socket.instances[0].fail(request.id, outcome.error); else Socket.instances[0].reply(request.id, outcome.result);
    await settle(el);
  };
  const alertText = (el: NoizuAuth) => el.shadowRoot!.querySelector('[role=alert]')!.textContent!.trim();

  it('shows the optional hint, wired to the input, and keeps the field optional', async () => {
    const el = await mount();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[name=invite_token]')!;
    expect(input.required).to.equal(false);
    const hint = el.shadowRoot!.querySelector('[data-cy=invite-token-hint]')!;
    expect(hint.textContent).to.equal('have an invite? enter it now — otherwise you can add it after signing up.');
    expect(input.getAttribute('aria-describedby')).to.equal(hint.id);
  });

  it('renders no hint when the mode is left at its default, nor in required/hidden mode', async () => {
    for (const mode of [undefined, 'required', 'hidden']) {
      const el = await mount({mode});
      expect(el.shadowRoot!.querySelector('[data-cy=invite-token-hint]'), `mode=${mode}`).not.to.exist;
    }
    const legacy = await mount({mode: undefined});
    // The default still reflects (unchanged since 0.1), but reflection is not an explicit choice.
    expect(legacy.getAttribute('invite-token-mode')).to.equal('optional');
  });

  it('also opts in when the mode is set as a property (React/JSX hosts)', async () => {
    const el = await fixture<GateHarness>(html`<noizu-auth-invite-gate-test flow="signup" .inviteTokenMode=${'optional'}></noizu-auth-invite-gate-test>`);
    await settle(el); fill(el,'email','me@test.com'); submit(el); await settle(el);
    expect(el.shadowRoot!.querySelector('[data-cy=invite-token-hint]')).to.exist;
    expect(el.getAttribute('invite-token-mode')).to.equal('optional');
  });

  it('routes an invite_required register error to the interstitial instead of rendering it', async () => {
    const el = await mount();
    const seen: string[] = []; el.addEventListener('auth-error', () => seen.push('auth-error'));
    let detail: unknown; el.addEventListener('noizu-auth-invite-required', (e) => {detail = (e as CustomEvent).detail;});
    await register(el, {error: {code: 'invite_required', message: 'An invite code is required'}});
    expect(alertText(el)).to.equal('');
    expect(seen).to.deep.equal([]);
    expect(detail).to.deep.equal({url: '/auth/invite-required', source: 'register-error'});
    expect(el.shadowRoot!.querySelector('[role=status]')!.textContent).to.include('invite page');
    expect(navigated()).to.deep.equal(['/auth/invite-required']);
  });

  it('routes to a custom invite-required-url, and never on message prose alone', async () => {
    const el = await mount({mode: 'optional', url: '/join/invite'});
    await register(el, {error: {code: 'INVITE_REQUIRED', message: 'held'}});
    expect(navigated()).to.deep.equal(['/join/invite']);
    GateHarness.navigated = []; Socket.instances = [];
    const prose = await mount({mode: 'optional', url: '/join/invite'});
    await register(prose, {error: {code: 'validation_failed', message: 'An invite code is required'}});
    expect(alertText(prose)).to.include('An invite code is required');
    expect(navigated()).to.deep.equal([]);
  });

  it('drops the hint and its aria-describedby when text.inviteHint is emptied', async () => {
    const el = await fixture<GateHarness>(html`<noizu-auth-invite-gate-test flow="signup" invite-token-mode="optional" .text=${{inviteHint: ''}}></noizu-auth-invite-gate-test>`);
    await settle(el); fill(el,'email','me@test.com'); submit(el); await settle(el);
    expect(el.shadowRoot!.querySelector('[data-cy=invite-token-hint]')).not.to.exist;
    expect(el.shadowRoot!.querySelector('[name=invite_token]')!.hasAttribute('aria-describedby')).to.equal(false);
  });

  it('hands over the session, then routes, when register succeeds for a held account', async () => {
    const el = await mount();
    const order: string[] = [];
    el.addEventListener('auth-success', () => order.push('auth-success'));
    el.addEventListener('noizu-auth-invite-required', () => order.push(`invite-required:${navigated().length}`));
    await register(el, {result: {authenticated: true, user: {status: 'pending', invite_required: true}}});
    expect(order).to.deep.equal(['auth-success', 'invite-required:0']);
    expect(navigated()).to.deep.equal(['/auth/invite-required']);
  });

  it('lets an active account through untouched', async () => {
    const el = await mount();
    let success = false; el.addEventListener('auth-success', () => {success = true;});
    await register(el, {result: {authenticated: true, user: {status: 'active', invite_required: false}}});
    expect(success).to.equal(true);
    expect(navigated()).to.deep.equal([]);
  });

  it('does not navigate when the host cancels noizu-auth-invite-required', async () => {
    const el = await mount();
    el.addEventListener('noizu-auth-invite-required', (e) => e.preventDefault());
    await register(el, {error: {code: 'invite_required', message: 'An invite code is required'}});
    expect(navigated()).to.deep.equal([]);
    expect(alertText(el)).to.equal('');
  });

  it('keeps legacy error rendering when the mode is unset, required, or routing is turned off', async () => {
    for (const opts of [{mode: undefined}, {mode: 'required'}, {mode: 'optional', url: ''}, {mode: 'optional', url: 'https://evil.test/x'}]) {
      GateHarness.navigated = [];
      const el = await mount(opts);
      if (opts.mode === 'required') fill(el, 'invite_token', 'tok');
      await register(el, {error: {code: 'invite_required', message: 'An invite code is required'}});
      expect(alertText(el), JSON.stringify(opts)).to.include('An invite code is required');
      expect(navigated(), JSON.stringify(opts)).to.deep.equal([]);
      Socket.instances = [];
    }
  });

  it('routes from the pipes flow (REST-shaped session.user) too', async () => {
    const el = await mount({mode: 'optional', pipes: ['email_password']});
    const seen: string[] = [];
    for (const name of ['auth-success', 'noizu-auth-success']) el.addEventListener(name, () => seen.push(name));
    await register(el, {result: {authenticated: true, session: {accessToken: 't', user: {invite_required: true}}}});
    expect(seen).to.deep.equal(['auth-success', 'noizu-auth-success']);
    expect((el as unknown as {pipeState: string}).pipeState).to.equal('success');
    expect(navigated()).to.deep.equal(['/auth/invite-required']);
  });

  it('routes a pipes-flow invite_required error with no error block', async () => {
    const el = await mount({mode: 'optional', pipes: ['email_password']});
    await register(el, {error: {code: 'invite_required', message: 'An invite code is required'}});
    expect(alertText(el)).to.equal('');
    expect((el as unknown as {pipeState: string}).pipeState).to.equal('success');
    expect(navigated()).to.deep.equal(['/auth/invite-required']);
  });
});

describe('dropdown mode', () => {
  const native = globalThis.WebSocket;
  beforeEach(() => {Socket.instances=[]; globalThis.WebSocket=Socket as unknown as typeof WebSocket;});
  afterEach(() => {fixtureCleanup(); globalThis.WebSocket=native;});

  it('is closed by default with correct trigger ARIA', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="dropdown"></noizu-auth>`);await settle(el);
    const trigger=el.shadowRoot!.querySelector<HTMLButtonElement>('[part=trigger]')!;
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
    expect(trigger.getAttribute('aria-controls')).to.equal('dropdown-panel');
    expect(el.shadowRoot!.querySelector('[part=dropdown-panel]')).not.to.exist;
  });

  it('opens on trigger click, moves focus in, and updates aria-expanded', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="dropdown"></noizu-auth>`);await settle(el);
    const trigger=el.shadowRoot!.querySelector<HTMLButtonElement>('[part=trigger]')!;
    trigger.click();await settle(el);
    expect(trigger.getAttribute('aria-expanded')).to.equal('true');
    const panel=el.shadowRoot!.querySelector('[part=dropdown-panel]');
    expect(panel).to.exist;
    expect(el.shadowRoot!.activeElement).to.exist;
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="dropdown"></noizu-auth>`);await settle(el);
    const trigger=el.shadowRoot!.querySelector<HTMLButtonElement>('[part=trigger]')!;
    trigger.click();await settle(el);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await settle(el);
    expect(el.open).to.equal(false);
    expect(el.shadowRoot!.activeElement).to.equal(trigger);
  });

  it('closes on outside click but not on clicks inside the panel', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="dropdown"></noizu-auth>`);await settle(el);
    const trigger=el.shadowRoot!.querySelector<HTMLButtonElement>('[part=trigger]')!;
    trigger.click();await settle(el);
    const panel=el.shadowRoot!.querySelector('[part=dropdown-panel]')!;
    panel.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));await settle(el);
    expect(el.open).to.equal(true);
    document.body.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));await settle(el);
    expect(el.open).to.equal(false);
  });

  it('wires a slotted host trigger: click toggles, ARIA stays in sync', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="dropdown"><button slot="trigger" id="host-trigger">Log in</button></noizu-auth>`);await settle(el);
    const hostTrigger=el.querySelector<HTMLButtonElement>('#host-trigger')!;
    expect(hostTrigger.getAttribute('aria-controls')).to.equal('dropdown-panel');
    expect(hostTrigger.getAttribute('aria-expanded')).to.equal('false');
    hostTrigger.click();await settle(el);
    expect(el.open).to.equal(true);
    expect(hostTrigger.getAttribute('aria-expanded')).to.equal('true');
    hostTrigger.click();await settle(el);
    expect(el.open).to.equal(false);
    expect(hostTrigger.getAttribute('aria-expanded')).to.equal('false');
  });

  it('does not trap focus: an interior submit button remains natively focusable in tab order', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="dropdown" .pipes=${['email_password']}></noizu-auth>`);await settle(el);
    const trigger=el.shadowRoot!.querySelector<HTMLButtonElement>('[part=trigger]')!;
    trigger.click();await settle(el);
    const submitButton=el.shadowRoot!.querySelector<HTMLButtonElement>('[part~=submit]')!;
    expect(submitButton.tabIndex).to.be.lessThan(1);
  });

  it('switches to modal for signup and back to dropdown for login per spec', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth mode="dropdown"></noizu-auth>`);await settle(el);
    const trigger=el.shadowRoot!.querySelector<HTMLButtonElement>('[part=trigger]')!;
    trigger.click();await settle(el);
    const toggle=el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="flow-toggle"]')!;
    toggle.click();await settle(el);
    expect(el.mode).to.equal('modal');expect(el.flow).to.equal('signup');expect(el.open).to.equal(true);
    const back=el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="flow-toggle"]')!;
    back.click();await settle(el);
    expect(el.mode).to.equal('dropdown');expect(el.flow).to.equal('login');
  });
});

describe('SMS region gating (smsRegions)', () => {
  const native = globalThis.WebSocket;
  beforeEach(() => {Socket.instances=[]; globalThis.WebSocket=Socket as unknown as typeof WebSocket;});
  afterEach(() => {fixtureCleanup(); globalThis.WebSocket=native;});

  it('leaves mobile pipes fully usable when smsRegions is unset (regression)', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['mobile_password']}></noizu-auth>`);await settle(el);
    expect(el.shadowRoot!.querySelector('[data-cy="sms-region-notice"]')).not.to.exist;
    const submitButton=el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="pipe-submit"]')!;
    expect(submitButton.getAttribute('aria-disabled')).to.equal(null);
    const phone=el.shadowRoot!.querySelector('noizu-phone-input') as any;
    phone.value='+15551234567';phone.dispatchEvent(new CustomEvent('phone-change',{detail:{value:'+15551234567'}}));
    fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0],request=socket.messages.find(m=>m.method==='login');
    expect(request).to.exist;expect(request.params).to.deep.equal({mobile_phone:'+15551234567',password:'secret123'});
  });

  it('enables submit and hides the notice for a supported region', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['mobile_password']} .smsRegions=${{supported:['US','CA']}}></noizu-auth>`);await settle(el);
    const notice=el.shadowRoot!.querySelector<HTMLElement>('[data-cy="sms-region-notice"]')!;
    expect(notice).to.exist;expect(notice.hidden).to.equal(true);
    const submitButton=el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="pipe-submit"]')!;
    expect(submitButton.getAttribute('aria-disabled')).to.equal(null);
    const phone=el.shadowRoot!.querySelector('noizu-phone-input') as any;
    phone.value='+15551234567';phone.dispatchEvent(new CustomEvent('phone-change',{detail:{value:'+15551234567'}}));
    fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0],request=socket.messages.find(m=>m.method==='login');
    expect(request).to.exist;
  });

  it('shows the inline message and disables (but keeps focusable) submit for an unsupported region, and blocks the network call', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['mobile_password']} .smsRegions=${{supported:['GB']}}></noizu-auth>`);await settle(el);
    const notice=el.shadowRoot!.querySelector<HTMLElement>('[data-cy="sms-region-notice"]')!;
    expect(notice.hidden).to.equal(false);
    expect(notice.textContent).to.include('SMS is not currently available for this region.');
    const submitButton=el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="pipe-submit"]')!;
    expect(submitButton.getAttribute('aria-disabled')).to.equal('true');
    expect(submitButton.disabled).to.equal(false, 'aria-disabled must not remove the control from the tab order');
    const phone=el.shadowRoot!.querySelector('noizu-phone-input') as any;
    expect(phone.describedBy).to.equal('sms-region-notice');
    phone.value='+447911123456';phone.dispatchEvent(new CustomEvent('phone-change',{detail:{value:'+447911123456'}}));
    fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0];
    expect(socket.messages.some(m=>m.method==='login')).to.equal(false);
  });

  it('applies a custom override message and clears the block on country change', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['mobile_password']} .smsRegions=${{supported:['GB'],message:'Try email instead.'}}></noizu-auth>`);await settle(el);
    const notice=el.shadowRoot!.querySelector<HTMLElement>('[data-cy="sms-region-notice"]')!;
    expect(notice.textContent).to.include('Try email instead.');
    const phone=el.shadowRoot!.querySelector('noizu-phone-input')!;
    phone.dispatchEvent(new CustomEvent('country-change',{detail:{country:'GB',dial:'+44'}}));await settle(el);
    expect(notice.hidden).to.equal(true);
  });

  it('renders the server sms_region_unsupported message even when the client-side check passed', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['mobile_password']} .smsRegions=${{supported:['US']}}></noizu-auth>`);await settle(el);
    let unsupported: unknown;
    el.addEventListener('noizu-auth-sms-region-unsupported',(e)=>{unsupported=(e as CustomEvent).detail;});
    const phone=el.shadowRoot!.querySelector('noizu-phone-input') as any;
    phone.value='+15551234567';phone.dispatchEvent(new CustomEvent('phone-change',{detail:{value:'+15551234567'}}));
    fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0],request=socket.messages.find(m=>m.method==='login');
    socket.fail(request.id,{code:'sms_region_unsupported',message:'Server: this area code is not SMS-enabled.'});await settle(el);
    const notice=el.shadowRoot!.querySelector<HTMLElement>('[data-cy="sms-region-notice"]')!;
    expect(notice.hidden).to.equal(false);
    expect(notice.textContent).to.include('Server: this area code is not SMS-enabled.');
    expect(el.shadowRoot!.querySelector('[data-cy="auth-error"]')!.textContent).to.equal('');
    expect(unsupported).to.deep.equal({pipe:'mobile_password',message:'Server: this area code is not SMS-enabled.'});
  });

  it('does not gate the other pipes when smsRegions is set', async () => {
    const el=await fixture<NoizuAuth>(html`<noizu-auth .pipes=${['email_password','mobile_password']} .smsRegions=${{supported:['GB']}}></noizu-auth>`);await settle(el);
    expect(el.shadowRoot!.querySelector('[data-cy="sms-region-notice"]')).not.to.exist;
    fill(el,'email','me@test.com');fill(el,'password','secret123');submit(el);await settle(el);
    const socket=Socket.instances[0],request=socket.messages.find(m=>m.method==='login');
    expect(request).to.exist;expect(request.params).to.deep.equal({email:'me@test.com',password:'secret123'});
  });
});
