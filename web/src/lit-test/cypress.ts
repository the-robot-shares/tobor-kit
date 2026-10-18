/// <reference types="cypress" />
/**
 * Shared Cypress helpers for kit islands. Family `test/steps.ts` / `test/asserts.ts`
 * should call these rather than reimplementing mount-proof logic.
 * See docs/CONVENTIONS.md §7.
 */

export const LOAD_ERROR_COPY = ["Couldn't load", 'may not be published'] as const;

export function waitDefined(tag: string, timeout = 15_000): void {
  cy.window({timeout}).then((win) => win.customElements.whenDefined(tag));
}

export function assertMounted(tag: string, timeout = 15_000): void {
  cy.get(tag, {timeout}).should('exist');
}

export function assertDemoFrameVisible(tag: string, timeout = 15_000): void {
  cy.get(tag, {timeout}).parents('.demo-frame').should('be.visible');
}

export function assertNoLoadError(): void {
  for (const copy of LOAD_ERROR_COPY) {
    cy.get('body').should('not.contain', copy);
  }
}

export function byCy(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(`[data-cy="${name}"]`);
}

export function inShadow(tag: string, selector: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get(tag).shadow().find(selector);
}
