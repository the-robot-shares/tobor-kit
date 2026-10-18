/// <reference types="cypress" />
import {taskMenuAsserts as asserts} from './asserts';
import {SAMPLE_INVENTORY, taskMenuSteps as steps, type ToolInventoryFixture} from './steps';

export {};

declare global {
  namespace Cypress {
    interface Chainable {
      taskMenuVisit(path?: string): void;
      taskMenuWaitDefined(timeout?: number): void;
      taskMenuMount(): void;
      taskMenuNoLoadError(): void;
      taskMenuSetInventory(inventory?: ToolInventoryFixture): void;
      taskMenuOpen(): void;
      taskMenuSelect(name: string): void;
      taskMenuConfirm(): void;
    }
  }
}

Cypress.Commands.add('taskMenuVisit', (path?: string) => {
  steps.visit(path);
});

Cypress.Commands.add('taskMenuWaitDefined', (timeout?: number) => {
  steps.waitDefined('tobor-task-menu', timeout);
});

Cypress.Commands.add('taskMenuMount', () => {
  steps.waitDefined();
  asserts.mounted();
});

Cypress.Commands.add('taskMenuNoLoadError', () => {
  asserts.noLoadError();
});

Cypress.Commands.add('taskMenuSetInventory', (inventory?: ToolInventoryFixture) => {
  steps.setInventory(inventory ?? SAMPLE_INVENTORY);
});

Cypress.Commands.add('taskMenuOpen', () => {
  steps.open();
});

Cypress.Commands.add('taskMenuSelect', (name: string) => {
  steps.select(name);
});

Cypress.Commands.add('taskMenuConfirm', () => {
  steps.confirm();
});
