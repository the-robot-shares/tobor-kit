/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';

const TAG = 'noizu-phone-input';

export const phoneInputSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureEvents(): void {
    cy.window().then((win) => {
      const state = win as Window & {
        __phoneChange?: {value: string};
        __phoneInvalid?: {value: string};
        __countryChange?: {country: string; dial: string};
      };
      win.document.addEventListener('phone-change', (event) => {
        state.__phoneChange = (event as CustomEvent<{value: string}>).detail;
      });
      win.document.addEventListener('phone-invalid', (event) => {
        state.__phoneInvalid = (event as CustomEvent<{value: string}>).detail;
      });
      win.document.addEventListener('country-change', (event) => {
        state.__countryChange = (event as CustomEvent<{country: string; dial: string}>).detail;
      });
    });
  },
  setCountry(iso2: string, tag = TAG): void {
    inShadow(tag, '[data-cy="phone.country"]').select(iso2);
  },
  typeNational(value: string, tag = TAG): void {
    inShadow(tag, '[data-cy="phone.input"]').clear().type(value);
  },
};
