/// <reference types="cypress" />
import {humanVerifyAsserts} from './asserts';
import {humanVerifySteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      humanVerifyVisit(path?: string): void;
      humanVerifyWaitDefined(tag?: string, timeout?: number): void;
      humanVerifyMount(tag?: string): void;
      humanVerifyNoLoadError(): void;
      humanVerifyReset(tag?: string): void;
      humanVerifyHooks(tag?: string): void;
    }
  }
}

Cypress.Commands.add('humanVerifyVisit', (path?: string) => {
  humanVerifySteps.visit(path);
});

Cypress.Commands.add('humanVerifyWaitDefined', (tag?: string, timeout?: number) => {
  humanVerifySteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('humanVerifyMount', (tag = 'noizu-human-verify') => {
  humanVerifySteps.waitDefined(tag);
  humanVerifyAsserts.mounted(tag);
});

Cypress.Commands.add('humanVerifyNoLoadError', () => {
  humanVerifyAsserts.noLoadError();
});

Cypress.Commands.add('humanVerifyReset', (tag?: string) => {
  humanVerifySteps.reset(tag);
});

Cypress.Commands.add('humanVerifyHooks', (tag?: string) => {
  humanVerifyAsserts.hooks(tag);
});

export {};
