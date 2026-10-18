/// <reference types="cypress" />
import {wikiAsserts} from './asserts';
import {wikiSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      wikiVisit(path?: string): void;
      wikiWaitDefined(tag?: string, timeout?: number): void;
      wikiMount(tag?: string): void;
      wikiNoLoadError(): void;
      wikiSelectSpace(id: string, tag?: string): void;
      wikiEdit(tag?: string): void;
      wikiSave(tag?: string): void;
    }
  }
}

Cypress.Commands.add('wikiVisit', (path?: string) => {
  wikiSteps.visit(path);
});
Cypress.Commands.add('wikiWaitDefined', (tag?: string, timeout?: number) => {
  wikiSteps.waitDefined(tag, timeout);
});
Cypress.Commands.add('wikiMount', (tag = 'tobor-wiki-entry') => {
  wikiSteps.waitDefined(tag);
  wikiAsserts.mounted(tag);
});
Cypress.Commands.add('wikiNoLoadError', () => {
  wikiAsserts.noLoadError();
});
Cypress.Commands.add('wikiSelectSpace', (id: string, tag?: string) => {
  wikiSteps.selectSpace(id, tag);
});
Cypress.Commands.add('wikiEdit', (tag?: string) => {
  wikiSteps.edit(tag);
});
Cypress.Commands.add('wikiSave', (tag?: string) => {
  wikiSteps.save(tag);
});

export {};
