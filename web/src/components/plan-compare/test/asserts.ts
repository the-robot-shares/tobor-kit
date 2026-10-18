/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError as kitNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'noizu-plan-compare';

export const planCompareAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  catalogMounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    kitNoLoadError();
  },
  cardCount(count: number): void {
    inShadow(TAG, '[data-cy="plan.card"]').should('have.length', count);
  },
  interval(value: 'monthly' | 'yearly'): void {
    inShadow(TAG, '[part="price"]').first().should('have.attr', 'data-interval', value);
  },
  lastSelect(expected: {planId: string; checkoutUrl: string; interval: string}): void {
    cy.window().its('__planSelect').should('deep.equal', expected);
  },
};
