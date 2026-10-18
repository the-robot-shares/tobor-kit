/// <reference types="cypress" />
import {modelConfigAsserts as asserts} from './asserts';
import {modelConfigSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      modelConfigVisit(path?: string): void;
      modelConfigWaitDefined(tag?: string, timeout?: number): void;
      modelConfigMount(): void;
      modelConfigNoLoadError(): void;
      modelConfigSelect(spec: string): void;
      modelConfigChanged(expected: {value: string}): void;
    }
  }
}

Cypress.Commands.add('modelConfigVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('modelConfigWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});
Cypress.Commands.add('modelConfigMount', () => {
  steps.waitDefined();
  asserts.mounted();
});
Cypress.Commands.add('modelConfigNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('modelConfigSelect', (spec: string) => {
  steps.selectSpec(spec);
});
Cypress.Commands.add('modelConfigChanged', (expected: {value: string}) => {
  asserts.lastModelChange(expected);
});

export {};
