/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'tobor-transcript-view';

export const transcriptViewAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  visibleState(tag = TAG): void {
    cy.get(tag).shadow().should(($root) => {
      const empty = $root.find('[data-testid="transcript-empty"]').length;
      const notice = $root.find('[data-testid="not-server-backed"]').length;
      const log = $root.find('[role="log"]').length;
      expect(empty + notice + log, 'empty, not-server-backed, or log').to.be.greaterThan(0);
    });
  },
  empty(tag = TAG): void {
    inShadow(tag, '[data-testid="transcript-empty"]').should('contain', 'Nothing said yet.');
  },
  notServerBacked(tag = TAG): void {
    inShadow(tag, '[data-testid="not-server-backed"]').should('contain', 'server stores no copy');
  },
  pending(tag = TAG): void {
    inShadow(tag, '[data-testid="pending-turn"]').should('exist');
  },
  clearControl(tag = TAG): void {
    inShadow(tag, '[data-testid="transcript-clear"]').should('exist');
  },
};
