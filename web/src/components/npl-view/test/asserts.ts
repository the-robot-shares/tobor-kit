/// <reference types="cypress" />
import {assertDemoFrameVisible, assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';

const TAG = 'tobor-npl-view';

export const nplViewAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = TAG): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  viewVisible(tag = TAG): void {
    inShadow(tag, '[data-cy="npl.view"]').should('exist');
  },
  hasFolds(tag = TAG): void {
    inShadow(tag, '[data-cy="npl.fold"]').should('have.length.at.least', 1);
  },
  lastCopy(expected: {text: string}, tag = TAG): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__copies?: {text: string}[]}).__copies;
      expect(log, 'npl-copy log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.deep.equal(expected);
    });
  },
};
