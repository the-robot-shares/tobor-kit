/// <reference types="cypress" />
import {assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';
import {TAG} from './steps';

export const taskMenuAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
    cy.get(tag).then(($el) => {
      const frame = $el.closest('.demo-frame');
      if (frame.length) {
        cy.wrap(frame).should('be.visible', {timeout: 15_000});
      }
    });
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  open(tag = TAG): void {
    cy.get(tag).should('have.attr', 'open');
    inShadow(tag, '[data-testid="task-menu-panel"]').should('exist');
  },
  closed(tag = TAG): void {
    cy.get(tag).should('not.have.attr', 'open');
  },
  toolVisible(name: string, tag = TAG): void {
    inShadow(tag, `[data-tool="${name}"]`).should('be.visible');
  },
  confirmPrompt(tag = TAG): void {
    inShadow(tag, '[data-testid="task-confirm-text"]').should('be.visible');
  },
  empty(tag = TAG): void {
    inShadow(tag, '[data-testid="task-menu-empty"]').should('contain', 'No tasks available.');
  },
  degradedVisible(tag = TAG): void {
    inShadow(tag, '[data-testid="task-menu-degraded"]').should('be.visible');
    inShadow(tag, '[data-testid="task-menu-degraded"]').should('contain', 'tickets');
  },
  selected(name: string): void {
    cy.window().should((win) => {
      const detail = (win as Window & {__taskSelect?: {tool?: {name: string}}}).__taskSelect;
      expect(detail?.tool?.name).to.equal(name);
    });
  },
  noSelection(): void {
    cy.window().should((win) => {
      expect((win as Window & {__taskSelect?: unknown}).__taskSelect).to.equal(null);
    });
  },
};
