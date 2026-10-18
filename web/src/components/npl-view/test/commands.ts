/// <reference types="cypress" />
import {nplViewAsserts as asserts} from './asserts';
import {nplViewSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      nplViewVisit(path?: string): void;
      nplViewWaitDefined(tag?: string, timeout?: number): void;
      nplViewMount(tag?: string): void;
      nplViewNoLoadError(): void;
      nplViewSetSource(source?: string, tag?: string): void;
      nplViewCopy(): void;
      nplViewToggleFold(index?: number, tag?: string): void;
    }
  }
}

Cypress.Commands.add('nplViewVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('nplViewWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});
Cypress.Commands.add('nplViewMount', (tag = 'tobor-npl-view') => {
  steps.waitDefined(tag);
  asserts.mounted(tag);
});
Cypress.Commands.add('nplViewNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('nplViewSetSource', (source?: string, tag?: string) => {
  steps.setSource(source, tag);
});
Cypress.Commands.add('nplViewCopy', () => {
  steps.copy();
});
Cypress.Commands.add('nplViewToggleFold', (index?: number, tag?: string) => {
  steps.toggleFold(index, tag);
});

export {};
