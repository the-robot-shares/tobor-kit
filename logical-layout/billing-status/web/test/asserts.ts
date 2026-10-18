/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

export const billingStatusAsserts = {
  mounted(tag = 'noizu-billing-status'): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = 'noizu-billing-status'): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  statusVisible(tag = 'noizu-billing-status'): void {
    inShadow(tag, '[data-cy="billing.status"]').should('be.visible');
  },
  portalVisible(tag = 'noizu-billing-status'): void {
    inShadow(tag, '[data-cy="billing.portal"]').should('be.visible');
  },
  statusText(value: string, tag = 'noizu-billing-status'): void {
    inShadow(tag, '[data-cy="billing.status"]').should('contain', value);
  },
  planText(value: string, tag = 'noizu-billing-status'): void {
    inShadow(tag, '[data-cy="billing.plan"]').should('contain', value);
  },
  portalOpenFired(tag = 'noizu-billing-status'): void {
    cy.get(tag).should(($el) => {
      const count = ($el[0] as HTMLElement & {__portalOpen?: number}).__portalOpen;
      expect(count, 'portal-open count').to.be.greaterThan(0);
    });
  },
};
