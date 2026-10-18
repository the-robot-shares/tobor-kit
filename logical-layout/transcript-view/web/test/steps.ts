/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

const TAG = 'tobor-transcript-view';

export const transcriptViewSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  setPending(value: string, tag = TAG): void {
    cy.get(tag).invoke('attr', 'pending', value);
  },
  clickClear(tag = TAG): void {
    inShadow(tag, '[data-testid="transcript-clear"]').click();
  },
};
