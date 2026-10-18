/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError as kitNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'tobor-robot-avatar';

export const robotAvatarAsserts = {
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
  state(value: string, tag = TAG): void {
    cy.get(tag).should('have.attr', 'data-state', value);
    inShadow(tag, '[data-testid="state-label"]').should('have.text', value);
  },
  motion(value: 'animated' | 'static', tag = TAG): void {
    cy.get(tag).should('have.attr', 'data-motion', value);
  },
  renderer(value: string, tag = TAG): void {
    cy.get(tag).should('have.attr', 'data-renderer', value);
  },
};
