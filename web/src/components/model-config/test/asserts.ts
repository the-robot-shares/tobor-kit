/// <reference types="cypress" />
import {assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';

const TAG = 'noizu-model-config';

export const modelConfigAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  picker(): void {
    inShadow(TAG, '[data-cy="model.picker"]').should('exist');
  },
  inheritOption(present = true): void {
    inShadow(TAG, '[data-cy="model.picker"]').should(($sel) => {
      const labels = [...($sel[0] as HTMLSelectElement).options].map((o) =>
        (o.textContent ?? '').trim(),
      );
      expect(labels.includes('Inherit')).to.equal(present);
    });
  },
  lastModelChange(expected: {value: string}, tag = TAG): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__modelChanges?: {value: string}[]}).__modelChanges;
      expect(log, 'model-change log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.deep.equal(expected);
    });
  },
};
