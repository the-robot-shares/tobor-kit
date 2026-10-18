/// <reference types="cypress" />
import {transcriptViewAsserts} from './asserts';
import {transcriptViewSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      transcriptVisit(path?: string): void;
      transcriptWaitDefined(tag?: string, timeout?: number): void;
      transcriptMount(tag?: string): void;
      transcriptNoLoadError(): void;
      transcriptShowsState(tag?: string): void;
      transcriptSetPending(value: string, tag?: string): void;
      transcriptClickClear(tag?: string): void;
    }
  }
}

Cypress.Commands.add('transcriptVisit', (path?: string) => {
  transcriptViewSteps.visit(path);
});

Cypress.Commands.add('transcriptWaitDefined', (tag?: string, timeout?: number) => {
  transcriptViewSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('transcriptMount', (tag?: string) => {
  transcriptViewSteps.waitDefined(tag);
  transcriptViewAsserts.mounted(tag);
});

Cypress.Commands.add('transcriptNoLoadError', () => {
  transcriptViewAsserts.noLoadError();
});

Cypress.Commands.add('transcriptShowsState', (tag?: string) => {
  transcriptViewAsserts.visibleState(tag);
});

Cypress.Commands.add('transcriptSetPending', (value: string, tag?: string) => {
  transcriptViewSteps.setPending(value, tag);
});

Cypress.Commands.add('transcriptClickClear', (tag?: string) => {
  transcriptViewSteps.clickClear(tag);
});

export {};
