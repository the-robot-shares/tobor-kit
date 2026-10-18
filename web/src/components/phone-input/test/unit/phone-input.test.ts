import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import '../../noizu-phone-input.js';
import {
  DIAL_CODES,
  type CountryChangeDetail,
  type NoizuPhoneInput,
  type PhoneChangeDetail,
  type PhoneInvalidDetail,
} from '../../noizu-phone-input.js';

const REQUIRED = [
  'US',
  'CA',
  'GB',
  'AU',
  'NZ',
  'DE',
  'FR',
  'JP',
  'KR',
  'CN',
  'IN',
  'TH',
  'SG',
  'AE',
  'BR',
  'MX',
] as const;

function inputOf(el: NoizuPhoneInput): HTMLInputElement {
  return el.shadowRoot!.querySelector('[data-cy="phone.input"]') as HTMLInputElement;
}

function countryOf(el: NoizuPhoneInput): HTMLSelectElement {
  return el.shadowRoot!.querySelector('[data-cy="phone.country"]') as HTMLSelectElement;
}

function dialOf(el: NoizuPhoneInput): HTMLElement {
  return el.shadowRoot!.querySelector('[data-cy="phone.dial"]') as HTMLElement;
}

async function typeNational(el: NoizuPhoneInput, text: string): Promise<void> {
  const input = inputOf(el);
  input.value = text;
  input.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
  await el.updateComplete;
}

describe('noizu-phone-input', () => {
  it('vendors 80+ ISO-3166 dial codes including required markets', () => {
    expect(DIAL_CODES.length).to.be.at.least(80);
    const iso = new Set(DIAL_CODES.map((row) => row.iso2));
    for (const code of REQUIRED) {
      expect(iso.has(code), code).to.equal(true);
    }
  });

  it('defaults to US and stamps data-cy hooks', async () => {
    const el = await fixture<NoizuPhoneInput>(html`<noizu-phone-input></noizu-phone-input>`);
    expect(el.country).to.equal('US');
    expect(countryOf(el)).to.exist;
    expect(dialOf(el).textContent).to.equal('+1');
    expect(inputOf(el)).to.exist;
    expect(inputOf(el).getAttribute('inputmode')).to.equal('tel');
  });

  it('set country, type digits, value becomes E.164', async () => {
    const el = await fixture<NoizuPhoneInput>(html`<noizu-phone-input></noizu-phone-input>`);
    el.country = 'GB';
    await el.updateComplete;
    expect(dialOf(el).textContent).to.equal('+44');

    const pending = oneEvent(el, 'phone-change');
    await typeNational(el, '7911123456');
    const ev = (await pending) as CustomEvent<PhoneChangeDetail>;
    expect(ev.detail.value).to.equal('+447911123456');
    expect(el.value).to.equal('+447911123456');
    expect(el.getAttribute('value')).to.equal('+447911123456');
  });

  it('mobile-only strips non-digits', async () => {
    const el = await fixture<NoizuPhoneInput>(
      html`<noizu-phone-input mobile-only></noizu-phone-input>`,
    );
    expect(el.mobileOnly).to.be.true;
    expect(inputOf(el).getAttribute('autocomplete')).to.equal('tel-national');
    expect(inputOf(el).getAttribute('inputmode')).to.equal('tel');

    await typeNational(el, '555-123-4567');
    expect(inputOf(el).value).to.equal('5551234567');
    expect(el.value).to.equal('+15551234567');
  });

  it('country-change fires from the selector', async () => {
    const el = await fixture<NoizuPhoneInput>(html`<noizu-phone-input></noizu-phone-input>`);
    const select = countryOf(el);
    const pending = oneEvent(el, 'country-change');
    select.value = 'GB';
    select.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
    const ev = (await pending) as CustomEvent<CountryChangeDetail>;
    expect(ev.detail.country).to.equal('GB');
    expect(ev.detail.dial).to.equal('+44');
    expect(el.country).to.equal('GB');
    await el.updateComplete;
    expect(dialOf(el).textContent).to.equal('+44');
  });

  it('phone-invalid fires for a short national number', async () => {
    const el = await fixture<NoizuPhoneInput>(html`<noizu-phone-input></noizu-phone-input>`);
    const pending = oneEvent(el, 'phone-invalid');
    await typeNational(el, '555');
    const ev = (await pending) as CustomEvent<PhoneInvalidDetail>;
    expect(ev.detail.value).to.equal('+1555');
    expect(el.value).to.equal('+1555');
  });

  it('hydrates country and national digits from an E.164 value', async () => {
    const el = await fixture<NoizuPhoneInput>(
      html`<noizu-phone-input value="+447911123456"></noizu-phone-input>`,
    );
    await el.updateComplete;
    expect(el.country).to.equal('GB');
    expect(inputOf(el).value).to.equal('7911123456');
    expect(dialOf(el).textContent).to.equal('+44');
  });

  it('unknown country falls back to US', async () => {
    const el = await fixture<NoizuPhoneInput>(
      html`<noizu-phone-input country="ZZ"></noizu-phone-input>`,
    );
    await el.updateComplete;
    expect(el.country).to.equal('US');
  });

  it('disabled disables selector and input', async () => {
    const el = await fixture<NoizuPhoneInput>(
      html`<noizu-phone-input disabled></noizu-phone-input>`,
    );
    expect(countryOf(el).disabled).to.be.true;
    expect(inputOf(el).disabled).to.be.true;
  });
});
