/// <reference types="cypress" />
import {personaAsserts} from './asserts.js';
import {personaSteps} from './steps.js';

declare global {
  namespace Cypress {
    interface Chainable {
      personaVisit(path?: string): void;
      personaWaitDefined(tag?: string, timeout?: number): void;
      personaMount(tag?: string): void;
      personaNoLoadError(): void;
      personaClickSelect(tag?: string): void;
      personaClickItem(personaId: string, tag?: string): void;
      personaLastSelect(personaId: string): void;
    }
  }
}

Cypress.Commands.add('personaVisit', (path?: string) => {
  personaSteps.visit(path);
});

Cypress.Commands.add('personaWaitDefined', (tag?: string, timeout?: number) => {
  personaSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('personaMount', (tag = 'tobor-persona-card') => {
  personaSteps.waitDefined(tag);
  personaAsserts.mounted(tag);
});

Cypress.Commands.add('personaNoLoadError', () => {
  personaAsserts.noLoadError();
});

Cypress.Commands.add('personaClickSelect', (tag?: string) => {
  personaSteps.clickSelect(tag);
});

Cypress.Commands.add('personaClickItem', (personaId: string, tag?: string) => {
  personaSteps.clickItem(personaId, tag);
});

Cypress.Commands.add('personaLastSelect', (personaId: string) => {
  personaAsserts.lastSelect(personaId);
});

export {};
