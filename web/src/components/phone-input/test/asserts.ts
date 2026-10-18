/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError as kitNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'noizu-phone-input';

export const phoneInputAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  catalogMounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    kitNoLoadError();
  },
  hooks(tag = TAG): void {
    inShadow(tag, '[data-cy="phone.country"]').should('exist');
    inShadow(tag, '[data-cy="phone.dial"]').should('exist');
    inShadow(tag, '[data-cy="phone.input"]').should('be.visible');
  },
  e164(value: string, tag = TAG): void {
    cy.get(tag).should(($el) => {
      expect(($el.get(0) as HTMLElement & {value: string}).value).to.equal(value);
    });
  },
  country(iso2: string, tag = TAG): void {
    cy.get(tag).should(($el) => {
      expect(($el.get(0) as HTMLElement & {country: string}).country).to.equal(iso2);
    });
    inShadow(tag, '[data-cy="phone.country"]').should('have.value', iso2);
  },
  lastPhoneChange(value: string): void {
    cy.window().its('__phoneChange').should('deep.equal', {value});
  },
  lastCountryChange(expected: {country: string; dial: string}): void {
    cy.window().its('__countryChange').should('deep.equal', expected);
  },
};
