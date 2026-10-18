/// <reference types="cypress" />
import {reviewPanelAsserts} from './asserts';
import {reviewPanelSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      reviewPanelVisit(path?: string): void;
      reviewPanelWaitDefined(tag?: string, timeout?: number): void;
      reviewPanelMount(tag?: string): void;
      reviewPanelNoLoadError(): void;
      reviewPanelTypeComposer(value: string, tag?: string): void;
      reviewPanelSubmit(tag?: string): void;
    }
  }
}

Cypress.Commands.add('reviewPanelVisit', (path?: string) => {
  reviewPanelSteps.visit(path);
});

Cypress.Commands.add('reviewPanelWaitDefined', (tag?: string, timeout?: number) => {
  reviewPanelSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('reviewPanelMount', (tag?: string) => {
  reviewPanelSteps.waitDefined(tag);
  reviewPanelAsserts.mounted(tag);
});

Cypress.Commands.add('reviewPanelNoLoadError', () => {
  reviewPanelAsserts.noLoadError();
});

Cypress.Commands.add('reviewPanelTypeComposer', (value: string, tag?: string) => {
  reviewPanelSteps.typeComposer(value, tag);
});

Cypress.Commands.add('reviewPanelSubmit', (tag?: string) => {
  reviewPanelSteps.submit(tag);
});

export {};
