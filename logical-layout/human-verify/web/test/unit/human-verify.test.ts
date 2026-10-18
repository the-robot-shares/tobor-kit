import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import {NoizuHumanVerify, type HumanVerifyDetail} from '../../noizu-human-verify.js';

describe('noizu-human-verify', () => {
  it('provider=none emits verified on connect', async () => {
    const el = document.createElement('noizu-human-verify') as NoizuHumanVerify;
    el.provider = 'none';
    const pending = oneEvent(el, 'verified');
    document.body.append(el);
    const ev = (await pending) as CustomEvent<HumanVerifyDetail>;
    expect(ev.detail).to.deep.equal({provider: 'none', token: ''});
    expect(ev.bubbles).to.equal(true);
    expect(ev.composed).to.equal(true);
    el.remove();
  });

  it('reset() exists and re-emits verified for provider=none', async () => {
    const el = await fixture<NoizuHumanVerify>(html`<noizu-human-verify></noizu-human-verify>`);
    expect(el.reset).to.be.a('function');
    const pending = oneEvent(el, 'verified');
    el.reset();
    const ev = (await pending) as CustomEvent<HumanVerifyDetail>;
    expect(ev.detail).to.deep.equal({provider: 'none', token: ''});
  });

  it('site-key is reflected', async () => {
    const el = await fixture<NoizuHumanVerify>(
      html`<noizu-human-verify site-key="public-site-key"></noizu-human-verify>`,
    );
    expect(el.siteKey).to.equal('public-site-key');
    expect(el.getAttribute('site-key')).to.equal('public-site-key');
    el.siteKey = 'public-site-key-2';
    await el.updateComplete;
    expect(el.getAttribute('site-key')).to.equal('public-site-key-2');
  });

  it('stamps data-cy hooks in shadow root', async () => {
    const el = await fixture<NoizuHumanVerify>(html`<noizu-human-verify></noizu-human-verify>`);
    expect(el.shadowRoot).to.exist;
    expect(el.shadowRoot!.querySelector('[data-cy="verify.root"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-cy="verify.widget"]')).to.exist;
  });

  it('defaults provider to none and action to signup', async () => {
    const el = await fixture<NoizuHumanVerify>(html`<noizu-human-verify></noizu-human-verify>`);
    expect(el.provider).to.equal('none');
    expect(el.action).to.equal('signup');
  });
});
