/// <reference types="cypress" />
// Isolation lane: noizu-phone-input on the blank harness page. No backend.
const el = () => cy.get('noizu-phone-input').shadow();
const country = () => el().find('[data-cy="phone.country"]');
const input = () => el().find('[data-cy="phone.input"]');

function visit() {
  cy.visit('/e2e/isolation/harness.html', {
    onBeforeLoad(win: any) {
      const s = win.document.createElement('script');
      s.type = 'module';
      s.textContent =
        "import '/dist/components/phone-input/noizu-phone-input.js';window.__modulesReady = true;";
      win.document.head.appendChild(s);
    },
  });
  cy.window().should('have.prop', '__modulesReady', true);
}

function mount(attrs: Record<string, string> = {}, props: Record<string, unknown> = {}) {
  return cy.window().then(async (win: any) => {
    await win.customElements.whenDefined('noizu-phone-input');
    win.unmount();
    win.__events.length = 0;
    const host = win.document.createElement('noizu-phone-input');
    const native = host.dispatchEvent.bind(host);
    host.dispatchEvent = (event: CustomEvent) => {
      if (event instanceof win.CustomEvent) {
        win.__events.push({type: event.type, detail: event.detail ? JSON.parse(JSON.stringify(event.detail)) : null});
      }
      return native(event);
    };
    for (const [name, value] of Object.entries(attrs)) host.setAttribute(name, value);
    for (const [name, value] of Object.entries(props)) host[name] = value;
    win.document.getElementById('mount-root').appendChild(host);
    return host;
  });
}

const events = () => cy.window().then((win: any) => win.__events);
const value = () => cy.get('noizu-phone-input').then(($el) => ($el[0] as any).value);

describe('Given a phone field, when interacting on the isolation harness, then country selection, digit entry and E.164 values stay in sync', () => {
  it('Given the default US country, when GB is selected, then country-change fires, the dial updates and no value is emitted for empty input', () => {
    visit();
    mount();
    country().should('have.value', 'US');
    el().find('[data-cy="phone.dial"]').should('have.text', '+1');
    country().select('GB');
    el().find('[data-cy="phone.dial"]').should('have.text', '+44');
    events().then((evts: any[]) => {
      const changes = evts.filter((e) => e.type === 'country-change');
      expect(changes.length, 'country-change emitted').to.eq(1);
      expect(changes[0].detail).to.deep.eq({country: 'GB', dial: '+44'});
      expect(evts.filter((e) => e.type === 'phone-change'), 'no phone-change for empty input').to.have.length(0);
    });
    cy.screenshot('phone-input-country-gb');
  });

  it('Given typed national digits, when the user enters a full number, then phone-change carries the kit E.164 value', () => {
    visit();
    mount();
    input().type('5551234567');
    value().should('eq', '+15551234567');
    events().then((evts: any[]) => {
      const changes = evts.filter((e) => e.type === 'phone-change');
      expect(changes.length).to.be.at.least(1);
      expect(changes.at(-1).detail).to.deep.eq({value: '+15551234567'});
      });
    cy.screenshot('phone-input-valid-e164');
  });

  it('Given mobile-only mode, when letters and short digit runs are entered, then non-digits are stripped and phone-invalid fires', () => {
    visit();
    mount({'mobile-only': ''});
    input().should('have.attr', 'autocomplete', 'tel-national');
    input().type('ab555');
    input().should('have.value', '555');
    value().should('eq', '+1555');
    el().find('[part="field"]').should('have.attr', 'data-invalid', 'true');
    input().should('have.attr', 'aria-invalid', 'true');
    events().then((evts: any[]) => {
      const invalid = evts.filter((e) => e.type === 'phone-invalid');
      expect(invalid.length, 'phone-invalid emitted').to.be.at.least(1);
      expect(invalid.at(-1).detail).to.deep.eq({value: '+1555'});
    });
    cy.screenshot('phone-input-mobile-only-invalid');
  });

  it('Given a full E.164 value property, when mounted, then the country and national digits are parsed back out', () => {
    visit();
    mount({}, {value: '+442071838750'});
    country().should('have.value', 'GB');
    el().find('[data-cy="phone.dial"]').should('have.text', '+44');
    input().should('have.value', '2071838750');
    el().find('[part="field"]').should('have.attr', 'data-invalid', 'false');
    cy.screenshot('phone-input-parsed-e164');
  });

  it('Given a pasted international number, when the input receives a + E.164 value, then the country flips and country-change fires', () => {
    visit();
    mount();
    input().invoke('val', '+33142689900').trigger('input');
    country().should('have.value', 'FR');
    el().find('[data-cy="phone.dial"]').should('have.text', '+33');
    value().should('eq', '+33142689900');
    events().then((evts: any[]) => {
      const changes = evts.filter((e) => e.type === 'country-change');
      expect(changes.length, 'country-change from pasted prefix').to.eq(1);
      expect(changes[0].detail).to.deep.eq({country: 'FR', dial: '+33'});
    });
    cy.screenshot('phone-input-international-prefix');
  });
});
