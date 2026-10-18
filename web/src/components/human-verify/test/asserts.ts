/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'noizu-human-verify';

export const humanVerifyAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = TAG): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  hooks(tag = TAG): void {
    inShadow(tag, '[data-cy="verify.root"]').should('exist');
    inShadow(tag, '[data-cy="verify.widget"]').should('exist');
  },
  lastVerified(
    expected: {provider: string; token: string},
    tag = TAG,
  ): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__verified?: {provider: string; token: string}[]})
        .__verified;
      expect(log, 'verified log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.deep.include(expected);
    });
  },
};
