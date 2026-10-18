/// <reference types="cypress" />
import {subscriptionGateAsserts} from './asserts';
import {subscriptionGateSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      subscriptionGateVisit(path?: string): void;
      subscriptionGateWaitDefined(tag?: string, timeout?: number): void;
      subscriptionGateMount(tag?: string): void;
      subscriptionGateNoLoadError(): void;
      subscriptionGateSetEntitled(entitled: boolean, tag?: string): void;
    }
  }
}

Cypress.Commands.add('subscriptionGateVisit', (path = '/') => {
  subscriptionGateSteps.visit(path);
});

Cypress.Commands.add('subscriptionGateWaitDefined', (tag?: string, timeout?: number) => {
  subscriptionGateSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('subscriptionGateMount', (tag = 'noizu-subscription-gate') => {
  subscriptionGateSteps.waitDefined(tag);
  subscriptionGateAsserts.mounted(tag);
});

Cypress.Commands.add('subscriptionGateNoLoadError', () => {
  subscriptionGateAsserts.noLoadError();
});

Cypress.Commands.add('subscriptionGateSetEntitled', (entitled: boolean, tag?: string) => {
  subscriptionGateSteps.setEntitled(entitled, tag);
});

export {};
