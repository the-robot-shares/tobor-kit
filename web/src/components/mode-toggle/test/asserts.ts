/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError as kitNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'tobor-mode-toggle';

export const modeToggleAsserts = {
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
  activeMode(mode: string): void {
    cy.get(TAG).should(($el) => {
      expect(($el.get(0) as HTMLElement & {mode: string}).mode).to.equal(mode);
    });
    inShadow(TAG, `button[data-mode="${mode}"]`).should('have.attr', 'aria-checked', 'true');
  },
  lastChange(expected: {mode: string; previous: string}): void {
    cy.window().its('__toborModeChange').should('deep.equal', expected);
  },
};
