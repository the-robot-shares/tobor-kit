/// <reference types="cypress" />
import {planCompareAsserts} from './asserts.js';
import {planCompareSteps} from './steps.js';

declare global {
  namespace Cypress {
    interface Chainable {
      planCompareVisit(path?: string): void;
      planCompareWaitDefined(tag?: string, timeout?: number): void;
      planCompareMount(): void;
      planCompareNoLoadError(): void;
      planCompareClickCta(planId?: string): void;
      planCompareToggleBilling(): void;
    }
  }
}

Cypress.Commands.add('planCompareVisit', (path?: string) => {
  planCompareSteps.visit(path);
});

Cypress.Commands.add('planCompareWaitDefined', (tag?: string, timeout?: number) => {
  planCompareSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('planCompareMount', () => {
  planCompareSteps.waitDefined();
  planCompareAsserts.mounted();
});

Cypress.Commands.add('planCompareNoLoadError', () => {
  planCompareAsserts.noLoadError();
});

Cypress.Commands.add('planCompareClickCta', (planId?: string) => {
  planCompareSteps.clickCta(planId);
});

Cypress.Commands.add('planCompareToggleBilling', () => {
  planCompareSteps.toggleBilling();
});

export {};
