import {elementUpdated, expect, fixture, html, oneEvent} from '@open-wc/testing';
import {NoizuCookieConsent} from '../../noizu-cookie-consent.js';
import {NoizuCookieSettings} from '../../noizu-cookie-settings.js';

function uniqueKey(name: string) {
  return `noizu-lit.cookie-test.${name}.${crypto.randomUUID()}`;
}

describe('noizu-cookie-consent', () => {
  it('shows the banner on first visit', async () => {
    const key = uniqueKey('first-visit');
    const el = await fixture<NoizuCookieConsent>(
      html`<noizu-cookie-consent storage-key=${key}></noizu-cookie-consent>`,
    );
    expect(el.querySelector('[data-cy="cookie.banner"]')).to.exist;
    expect(el.querySelectorAll('[data-cy="cookie.category"]').length).to.equal(4);
  });

  it('accept-all writes localStorage and fires cookie-consent-change', async () => {
    const key = uniqueKey('accept-all');
    const el = await fixture<NoizuCookieConsent>(
      html`<noizu-cookie-consent storage-key=${key}></noizu-cookie-consent>`,
    );
    const accept = el.querySelector<HTMLButtonElement>('[data-cy="cookie.accept-all"]');
    expect(accept).to.exist;
    const fired = oneEvent(el, 'cookie-consent-change');
    accept!.click();
    const event = await fired;
    await elementUpdated(el);

    expect(event.detail.version).to.equal(1);
    expect(event.detail.categories.necessary).to.equal(true);
    expect(event.detail.categories.analytics).to.equal(true);
    expect(event.detail.categories.marketing).to.equal(true);
    expect(event.detail.categories.preferences).to.equal(true);

    const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    expect(stored.version).to.equal(1);
    expect(stored.categories.analytics).to.equal(true);
    expect(stored.categories.marketing).to.equal(true);
    expect(stored.categories.preferences).to.equal(true);
    expect(el.querySelector('[data-cy="cookie.banner"]')).to.equal(null);
  });

  it('reject-optional stores analytics false', async () => {
    const key = uniqueKey('reject-optional');
    const el = await fixture<NoizuCookieConsent>(
      html`<noizu-cookie-consent storage-key=${key}></noizu-cookie-consent>`,
    );
    el.querySelector<HTMLButtonElement>('[data-cy="cookie.reject-optional"]')!.click();
    await elementUpdated(el);

    const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    expect(stored.categories.necessary).to.equal(true);
    expect(stored.categories.analytics).to.equal(false);
    expect(stored.categories.marketing).to.equal(false);
    expect(stored.categories.preferences).to.equal(false);
  });

  it('settings button re-opens the banner', async () => {
    const key = uniqueKey('settings-open');
    const wrap = await fixture<HTMLElement>(html`
      <div>
        <noizu-cookie-settings></noizu-cookie-settings>
        <noizu-cookie-consent storage-key=${key}></noizu-cookie-consent>
      </div>
    `);
    const consent = wrap.querySelector('noizu-cookie-consent')!;
    const settings = wrap.querySelector('noizu-cookie-settings')!;
    expect(settings).to.be.instanceOf(NoizuCookieSettings);
    consent.querySelector<HTMLButtonElement>('[data-cy="cookie.accept-all"]')!.click();
    await elementUpdated(consent);
    expect(consent.querySelector('[data-cy="cookie.banner"]')).to.equal(null);

    settings.querySelector<HTMLButtonElement>('[data-cy="cookie.settings"]')!.click();
    await elementUpdated(consent);
    expect(consent.querySelector('[data-cy="cookie.banner"]')).to.exist;

    const cancel = [...consent.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Cancel');
    expect(cancel).to.exist;
    cancel!.click();
    await elementUpdated(consent);
    expect(consent.querySelector('[data-cy="cookie.banner"]')).to.equal(null);
  });

  it('essential-all hides category checkboxes', async () => {
    const key = uniqueKey('essential-all');
    const el = await fixture<NoizuCookieConsent>(
      html`<noizu-cookie-consent storage-key=${key} mode="essential-all"></noizu-cookie-consent>`,
    );
    expect(el.querySelector('[data-cy="cookie.banner"]')).to.exist;
    expect(el.querySelector('[data-cy="cookie.category"]')).to.equal(null);
    expect(el.querySelector('[data-cy="cookie.save"]')).to.equal(null);
    expect(el.querySelector('[data-cy="cookie.accept-all"]')).to.exist;
    expect(el.querySelector('[data-cy="cookie.reject-optional"]')).to.exist;
  });
});
