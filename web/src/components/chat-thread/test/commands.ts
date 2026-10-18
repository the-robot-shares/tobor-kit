/// <reference types="cypress" />
import {chatThreadAsserts} from './asserts';
import {chatThreadSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      chatThreadVisit(path?: string): void;
      chatThreadWaitDefined(tag?: string, timeout?: number): void;
      chatThreadMount(tag?: string): void;
      chatThreadNoLoadError(): void;
      chatThreadTypeComposer(value: string, tag?: string): void;
      chatThreadSend(tag?: string): void;
    }
  }
}

Cypress.Commands.add('chatThreadVisit', (path?: string) => {
  chatThreadSteps.visit(path);
});

Cypress.Commands.add('chatThreadWaitDefined', (tag?: string, timeout?: number) => {
  chatThreadSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('chatThreadMount', (tag?: string) => {
  chatThreadSteps.waitDefined(tag);
  chatThreadAsserts.mounted(tag);
});

Cypress.Commands.add('chatThreadNoLoadError', () => {
  chatThreadAsserts.noLoadError();
});

Cypress.Commands.add('chatThreadTypeComposer', (value: string, tag?: string) => {
  chatThreadSteps.typeComposer(value, tag);
});

Cypress.Commands.add('chatThreadSend', (tag?: string) => {
  chatThreadSteps.send(tag);
});

export {};
