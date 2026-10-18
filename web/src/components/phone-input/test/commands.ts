/// <reference types="cypress" />
import {phoneInputAsserts} from './asserts.js';
import {phoneInputSteps} from './steps.js';

declare global {
  namespace Cypress {
    interface Chainable {
      phoneInputVisit(path?: string): void;
      phoneInputWaitDefined(tag?: string, timeout?: number): void;
      phoneInputMount(tag?: string): void;
      phoneInputNoLoadError(): void;
      phoneInputSetCountry(iso2: string): void;
      phoneInputTypeNational(value: string): void;
      phoneInputE164(value: string): void;
    }
  }
}

Cypress.Commands.add('phoneInputVisit', (path = '/') => {
  phoneInputSteps.visit(path);
});

Cypress.Commands.add('phoneInputWaitDefined', (tag?: string, timeout?: number) => {
  phoneInputSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('phoneInputMount', (tag = 'noizu-phone-input') => {
  phoneInputSteps.waitDefined(tag);
  phoneInputAsserts.mounted(tag);
});

Cypress.Commands.add('phoneInputNoLoadError', () => {
  phoneInputAsserts.noLoadError();
});

Cypress.Commands.add('phoneInputSetCountry', (iso2: string) => {
  phoneInputSteps.setCountry(iso2);
});

Cypress.Commands.add('phoneInputTypeNational', (value: string) => {
  phoneInputSteps.typeNational(value);
});

Cypress.Commands.add('phoneInputE164', (value: string) => {
  phoneInputAsserts.e164(value);
});

export {};
