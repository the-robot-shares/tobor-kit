/// <reference types="cypress" />
import {loginFlowAsserts as asserts} from './asserts';
import {loginFlowSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      loginFlowMount(path?: string): void;
      loginFlowVisit(path?: string): void;
      loginFlowWaitDefined(tag?: string, timeout?: number): void;
      loginFlowClickSignIn(tag?: string): void;
      loginFlowMounted(tag?: string): void;
      loginFlowNoLoadError(): void;
      loginFlowPromptOrSession(tag?: string): void;
    }
  }
}

Cypress.Commands.add('loginFlowVisit', (path?: string) => {
  steps.visit(path);
});

Cypress.Commands.add('loginFlowWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});

Cypress.Commands.add('loginFlowClickSignIn', (tag?: string) => {
  steps.clickSignIn(tag);
});

Cypress.Commands.add('loginFlowMounted', (tag?: string) => {
  asserts.mounted(tag);
});

Cypress.Commands.add('loginFlowNoLoadError', () => {
  asserts.noLoadError();
});

Cypress.Commands.add('loginFlowPromptOrSession', (tag?: string) => {
  asserts.promptOrSession(tag);
});

Cypress.Commands.add('loginFlowMount', (path?: string) => {
  steps.visit(path);
  steps.waitDefined();
  asserts.mounted();
});

export {};
