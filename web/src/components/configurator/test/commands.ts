/// <reference types="cypress" />
import {configuratorAsserts} from './asserts';
import {configuratorSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      configuratorVisit(path?: string): void;
      configuratorWaitDefined(tag?: string, timeout?: number): void;
      configuratorMount(tag?: string): void;
      configuratorNoLoadError(): void;
      configuratorApply(tag?: string): void;
    }
  }
}

Cypress.Commands.add('configuratorVisit', (path?: string) => {
  configuratorSteps.visit(path);
});

Cypress.Commands.add('configuratorWaitDefined', (tag?: string, timeout?: number) => {
  configuratorSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('configuratorMount', (tag?: string) => {
  configuratorSteps.waitDefined(tag);
  configuratorAsserts.mounted(tag);
});

Cypress.Commands.add('configuratorNoLoadError', () => {
  configuratorAsserts.noLoadError();
});

Cypress.Commands.add('configuratorApply', (tag?: string) => {
  configuratorSteps.apply(tag);
});

export {};
