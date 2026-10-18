/// <reference types="cypress" />
import {billingStatusAsserts} from './asserts';
import {billingStatusSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      billingStatusVisit(path?: string): void;
      billingStatusWaitDefined(tag?: string, timeout?: number): void;
      billingStatusMount(tag?: string): void;
      billingStatusNoLoadError(): void;
      billingStatusClickPortal(tag?: string): void;
      billingStatusStatusVisible(tag?: string): void;
      billingStatusPortalVisible(tag?: string): void;
    }
  }
}

Cypress.Commands.add('billingStatusVisit', (path = '/') => {
  billingStatusSteps.visit(path);
});

Cypress.Commands.add('billingStatusWaitDefined', (tag?: string, timeout?: number) => {
  billingStatusSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('billingStatusMount', (tag = 'noizu-billing-status') => {
  billingStatusSteps.waitDefined(tag);
  billingStatusAsserts.mounted(tag);
});

Cypress.Commands.add('billingStatusNoLoadError', () => {
  billingStatusAsserts.noLoadError();
});

Cypress.Commands.add('billingStatusClickPortal', (tag?: string) => {
  billingStatusSteps.clickPortal(tag);
});

Cypress.Commands.add('billingStatusStatusVisible', (tag?: string) => {
  billingStatusAsserts.statusVisible(tag);
});

Cypress.Commands.add('billingStatusPortalVisible', (tag?: string) => {
  billingStatusAsserts.portalVisible(tag);
});

export {};
