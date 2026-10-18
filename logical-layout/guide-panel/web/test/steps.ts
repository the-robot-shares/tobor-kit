/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

export const TAG = 'tobor-guide-panel';

export const guidePanelSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  expandIfCollapsed(): void {
    cy.get(TAG).shadow().then(($root) => {
      const expand = $root.find('[data-testid="expand"]');
      if (expand.length) cy.wrap(expand).click();
    });
  },
  collapse(): void {
    inShadow(TAG, '[data-testid="collapse"]').click();
  },
  typeInput(value: string): void {
    inShadow(TAG, '[data-testid="text-input"]').clear().type(value);
  },
  send(): void {
    inShadow(TAG, '[data-testid="send"]').click();
  },
};
