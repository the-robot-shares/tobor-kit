/// <reference types="cypress" />

import {toolListAsserts as asserts} from './asserts';
import {toolListSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      toolListVisit(path?: string): void;
      toolListWaitDefined(tag?: string, timeout?: number): void;
      toolListMount(): void;
      toolListNoLoadError(): void;
      toolListSetInventory(inventory?: unknown): void;
      toolListSelect(name: string): void;
    }
  }
}

Cypress.Commands.add('toolListVisit', (path?: string) => {
  steps.visit(path);
});

Cypress.Commands.add('toolListWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});

Cypress.Commands.add('toolListMount', () => {
  steps.waitDefined();
  asserts.mounted();
});

Cypress.Commands.add('toolListNoLoadError', () => {
  asserts.noLoadError();
});

Cypress.Commands.add('toolListSetInventory', (inventory?: unknown) => {
  steps.setInventory(inventory);
});

Cypress.Commands.add('toolListSelect', (name: string) => {
  steps.selectTool(name);
});

export {};
