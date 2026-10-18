/// <reference types="cypress" />
import {faqAsserts} from './asserts';
import {faqSteps, type FaqMode} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      faqVisit(path?: string): void;
      faqWaitDefined(tag?: string, timeout?: number): void;
      faqMount(tag?: string): void;
      faqNoLoadError(): void;
      faqSetMode(mode: FaqMode, tag?: string): void;
      faqOpenItem(index: number): void;
    }
  }
}

Cypress.Commands.add('faqVisit', (path?: string) => {
  faqSteps.visit(path);
});

Cypress.Commands.add('faqWaitDefined', (tag?: string, timeout?: number) => {
  faqSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('faqMount', (tag?: string) => {
  faqAsserts.mounted(tag);
});

Cypress.Commands.add('faqNoLoadError', () => {
  faqAsserts.noLoadError();
});

Cypress.Commands.add('faqSetMode', (mode: FaqMode, tag?: string) => {
  faqSteps.setMode(mode, tag);
});

Cypress.Commands.add('faqOpenItem', (index: number) => {
  faqSteps.openItem(index);
});

export {};
