/// <reference types="cypress" />
import {assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';

const TAG = 'noizu-invite-gate';

export const inviteGateAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  card(tag = TAG): void {
    inShadow(tag, '[data-cy="invite-required"]').should('be.visible');
    inShadow(tag, '[data-cy="invite-code-input"]').should('be.visible');
    inShadow(tag, '[data-cy="invite-redeem-submit"]').should('be.visible');
    inShadow(tag, '[data-cy="invite-sign-out"]').should('be.visible');
  },
  /** The input is labelled and the error region is an alert tied to it. */
  accessible(tag = TAG): void {
    inShadow(tag, 'label[for="invite-token"]').should('exist');
    inShadow(tag, '[data-cy="invite-error"]').should('have.attr', 'role', 'alert');
    inShadow(tag, '[data-cy="invite-code-input"]').should('have.attr', 'aria-describedby', 'invite-error');
  },
  error(code: string, text?: string, tag = TAG): void {
    inShadow(tag, '[data-cy="invite-error"]').should('be.visible').and('have.attr', 'data-code', code);
    if (text) inShadow(tag, '[data-cy="invite-error"]').should('contain.text', text);
    inShadow(tag, '[data-cy="invite-code-input"]').should('have.attr', 'aria-invalid', 'true');
  },
  noError(tag = TAG): void {
    inShadow(tag, '[data-cy="invite-error"]').should('not.be.visible');
  },
  redeemed(tag = TAG): void {
    inShadow(tag, '[data-cy="invite-status"]').should('contain.text', 'invite accepted');
  },
  redeemRequest(token: string): void {
    cy.wait('@inviteRedeem').its('request.body').should('deep.equal', {token});
  },
};
