/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

export const promptAsserts = {
  mounted(tag = 'tobor-prompt-library'): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = 'tobor-prompt-library'): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  library(tag = 'tobor-prompt-library'): void {
    inShadow(tag, '[data-cy="prompt.library"]').should('exist');
  },
  itemCount(count: number, tag = 'tobor-prompt-library'): void {
    inShadow(tag, '[data-cy="prompt.item"]').should('have.length', count);
  },
  bodyIsText(snippet: string, tag = 'tobor-prompt-library'): void {
    inShadow(tag, '[part="body"]').should('contain.text', snippet);
    inShadow(tag, '[part="body"] b').should('not.exist');
  },
  history(tag = 'tobor-prompt-history'): void {
    inShadow(tag, '[data-cy="prompt.history"]').should('exist');
  },
  forkCount(count: number, tag = 'tobor-prompt-history'): void {
    inShadow(tag, '[data-cy="prompt.fork"]').should('have.length', count);
  },
  lastSelect(id: string): void {
    cy.window().its('__promptSelect').should('deep.equal', {id});
  },
  lastStar(partial: {id: string; starred: boolean}): void {
    cy.window().its('__promptStar').should('deep.equal', partial);
  },
  lastFork(id: string): void {
    cy.window().its('__promptFork').should('deep.equal', {id});
  },
};
