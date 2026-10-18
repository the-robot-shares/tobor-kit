/// <reference types="cypress" />
import {guidePanelAsserts as asserts} from './asserts';
import {guidePanelSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      guidePanelVisit(path?: string): void;
      guidePanelWaitDefined(timeout?: number): void;
      guidePanelExpand(): void;
      guidePanelCollapse(): void;
      guidePanelType(value: string): void;
      guidePanelSend(): void;
      guidePanelMounted(): void;
      guidePanelNoLoadError(): void;
      guidePanelReady(): void;
    }
  }
}

Cypress.Commands.add('guidePanelVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('guidePanelWaitDefined', (timeout?: number) => {
  steps.waitDefined(undefined, timeout);
});
Cypress.Commands.add('guidePanelExpand', () => {
  steps.expandIfCollapsed();
});
Cypress.Commands.add('guidePanelCollapse', () => {
  steps.collapse();
});
Cypress.Commands.add('guidePanelType', (value: string) => {
  steps.typeInput(value);
});
Cypress.Commands.add('guidePanelSend', () => {
  steps.send();
});
Cypress.Commands.add('guidePanelMounted', () => {
  asserts.mounted();
});
Cypress.Commands.add('guidePanelNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('guidePanelReady', () => {
  asserts.ready();
});

export {};
