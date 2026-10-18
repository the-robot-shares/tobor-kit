/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

export const wikiSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'tobor-wiki-entry', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  selectSpace(id: string, tag = 'tobor-wiki-space'): void {
    inShadow(tag, `[data-cy="wiki.space-item"][data-space-id="${id}"]`).click();
  },
  edit(tag = 'tobor-wiki-entry'): void {
    inShadow(tag, '[part="edit"]').click();
  },
  typeTitle(value: string, tag = 'tobor-wiki-entry-editor'): void {
    inShadow(tag, '[part="title"]').clear().type(value);
  },
  typeBody(value: string, tag = 'tobor-wiki-entry-editor'): void {
    inShadow(tag, '[part="body"]').clear().type(value);
  },
  save(tag = 'tobor-wiki-entry-editor'): void {
    inShadow(tag, '[data-cy="wiki.save"]').click();
  },
  captureSave(): void {
    cy.window().then((win) => {
      const state = win as Window & {
        __wikiSave?: {id: string; title: string; body: string; spaceId?: string};
      };
      win.document.addEventListener('wiki-save', (event) => {
        state.__wikiSave = (event as CustomEvent<{
          id: string;
          title: string;
          body: string;
          spaceId?: string;
        }>).detail;
      });
    });
  },
};
