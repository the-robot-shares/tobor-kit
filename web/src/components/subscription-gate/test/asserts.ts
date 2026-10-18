/// <reference types="cypress" />
import {assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';

export const subscriptionGateAsserts = {
  mounted(tag = 'noizu-subscription-gate'): void {
    assertMounted(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  root(tag = 'noizu-subscription-gate'): void {
    inShadow(tag, '[data-cy="gate.root"]').should('exist');
  },
  blocked(tag = 'noizu-subscription-gate'): void {
    inShadow(tag, '[data-cy="gate.blocked"]').should('be.visible');
    inShadow(tag, '[data-cy="gate.link"]').should('be.visible');
  },
  entitled(tag = 'noizu-subscription-gate'): void {
    inShadow(tag, '[data-cy="gate.blocked"]').should('not.exist');
    inShadow(tag, 'slot').should('exist');
  },
  linkHref(href: string, tag = 'noizu-subscription-gate'): void {
    inShadow(tag, '[data-cy="gate.link"]').should('have.attr', 'href', href);
  },
};
