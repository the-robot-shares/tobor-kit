/// <reference types="cypress" />
import {promptAsserts} from './asserts';
import {promptSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      promptVisit(path?: string): void;
      promptWaitDefined(tag?: string, timeout?: number): void;
      promptMount(tag?: string): void;
      promptNoLoadError(): void;
      promptClickItem(id: string, tag?: string): void;
      promptClickStar(id: string, tag?: string): void;
      promptClickFork(id: string, tag?: string): void;
    }
  }
}

Cypress.Commands.add('promptVisit', (path?: string) => {
  promptSteps.visit(path);
});
Cypress.Commands.add('promptWaitDefined', (tag?: string, timeout?: number) => {
  promptSteps.waitDefined(tag, timeout);
});
Cypress.Commands.add('promptMount', (tag = 'tobor-prompt-library') => {
  promptSteps.waitDefined(tag);
  promptAsserts.mounted(tag);
});
Cypress.Commands.add('promptNoLoadError', () => {
  promptAsserts.noLoadError();
});
Cypress.Commands.add('promptClickItem', (id: string, tag?: string) => {
  promptSteps.clickItem(id, tag);
});
Cypress.Commands.add('promptClickStar', (id: string, tag?: string) => {
  promptSteps.clickStar(id, tag);
});
Cypress.Commands.add('promptClickFork', (id: string, tag?: string) => {
  promptSteps.clickFork(id, tag);
});

export {};
