/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

export const wikiAsserts = {
  mounted(tag = 'tobor-wiki-entry'): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = 'tobor-wiki-entry'): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  spaceList(tag = 'tobor-wiki-space'): void {
    inShadow(tag, '[data-cy="wiki.space"]').should('exist');
  },
  spaceItems(count: number, tag = 'tobor-wiki-space'): void {
    cy.get(tag).shadow().find('[data-cy="wiki.space-item"]').should('have.length', count);
  },
  entry(tag = 'tobor-wiki-entry'): void {
    inShadow(tag, '[data-cy="wiki.entry"]').should('exist');
  },
  bodyIsText(snippet: string, tag = 'tobor-wiki-entry'): void {
    inShadow(tag, '[part="body"]').should('contain.text', snippet);
    inShadow(tag, '[part="body"] b').should('not.exist');
  },
  editor(tag = 'tobor-wiki-entry-editor'): void {
    inShadow(tag, '[data-cy="wiki.editor"]').should('exist');
    inShadow(tag, '[data-cy="wiki.save"]').should('exist');
  },
  lastSave(partial: {id?: string; title?: string; body?: string}): void {
    cy.window().its('__wikiSave').should('include', partial);
  },
};
