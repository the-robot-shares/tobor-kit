/// <reference types="cypress" />
import {modeToggleAsserts} from './asserts.js';
import {modeToggleSteps} from './steps.js';

declare global {
  namespace Cypress {
    interface Chainable {
      modeToggleVisit(path?: string): void;
      modeToggleWaitDefined(tag?: string, timeout?: number): void;
      modeToggleMount(): void;
      modeToggleNoLoadError(): void;
      modeToggleSelect(mode: string): void;
      modeToggleChanged(expected: {mode: string; previous: string}): void;
    }
  }
}

Cypress.Commands.add('modeToggleVisit', (path?: string) => {
  modeToggleSteps.visit(path);
});

Cypress.Commands.add('modeToggleWaitDefined', (tag?: string, timeout?: number) => {
  modeToggleSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('modeToggleMount', () => {
  modeToggleSteps.waitDefined();
  modeToggleAsserts.mounted();
});

Cypress.Commands.add('modeToggleNoLoadError', () => {
  modeToggleAsserts.noLoadError();
});

Cypress.Commands.add('modeToggleSelect', (mode: string) => {
  modeToggleSteps.selectMode(mode);
});

Cypress.Commands.add('modeToggleChanged', (expected: {mode: string; previous: string}) => {
  modeToggleAsserts.lastChange(expected);
});

export {};
