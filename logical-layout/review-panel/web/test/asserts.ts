/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'tobor-review-panel';

export const reviewPanelAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  panel(tag = TAG): void {
    inShadow(tag, '[data-cy="review.panel"]').should('exist');
  },
  composer(tag = TAG): void {
    inShadow(tag, '[data-cy="review.composer"]').should('exist');
    inShadow(tag, '[data-cy="review.submit"]').should('exist');
  },
  emptyState(tag = TAG): void {
    cy.get(tag).shadow().should('contain.text', 'No reviews yet');
  },
  noRenderErrors(): void {
    cy.window().its('__reviewPanelErrors').should('deep.equal', []);
  },
  lastSubmit(detail: {artifactId: string; body: string}): void {
    cy.window().its('__reviewSubmit').should('deep.equal', detail);
  },
  lastResolve(id: string): void {
    cy.window().its('__reviewResolve').should('deep.equal', {id});
  },
};
