/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

export const billingStatusSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-billing-status', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  clickPortal(tag = 'noizu-billing-status'): void {
    inShadow(tag, '[data-cy="billing.portal"]').click();
  },
  capturePortalOpen(tag = 'noizu-billing-status'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {__portalOpen?: number};
      node.__portalOpen = 0;
      node.addEventListener('portal-open', () => {
        node.__portalOpen = (node.__portalOpen ?? 0) + 1;
      });
    });
  },
};
