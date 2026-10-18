/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

const TAG = 'noizu-invite-gate';

export const inviteGateSteps = {
  visit(path = '/auth/invite-required'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  /** Stub the redeem endpoint (default PATTERN.md path) with a status + body. */
  stubRedeem(statusCode: number, body: unknown, endpoint = '/api/v1/invites/redeem'): void {
    cy.intercept('POST', endpoint, {statusCode, body}).as('inviteRedeem');
  },
  typeCode(code: string, tag = TAG): void {
    inShadow(tag, '[data-cy="invite-code-input"]').clear().type(code);
  },
  submit(tag = TAG): void {
    inShadow(tag, '[data-cy="invite-redeem-submit"]').click();
  },
  redeem(code: string, tag = TAG): void {
    inviteGateSteps.typeCode(code, tag);
    inviteGateSteps.submit(tag);
  },
  /** Keep the browser on the page: cancel the redeemed / sign-out navigation. */
  cancelNavigation(tag = TAG): void {
    cy.get(tag).then(($el) => {
      for (const name of ['noizu-invite-redeemed', 'noizu-invite-sign-out']) $el[0].addEventListener(name, (event) => event.preventDefault());
    });
  },
  signOut(tag = TAG): void {
    inShadow(tag, '[data-cy="invite-sign-out"]').click();
  },
};
