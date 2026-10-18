/// <reference types="cypress" />
import {inviteGateAsserts} from './asserts';
import {inviteGateSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      inviteGateMount(tag?: string): void;
      inviteGateStubRedeem(statusCode: number, body: unknown, endpoint?: string): void;
      inviteGateRedeem(code: string, tag?: string): void;
      inviteGateAssertError(code: string, text?: string, tag?: string): void;
    }
  }
}

Cypress.Commands.add('inviteGateMount', (tag = 'noizu-invite-gate') => {
  inviteGateSteps.waitDefined(tag);
  inviteGateAsserts.mounted(tag);
});

Cypress.Commands.add('inviteGateStubRedeem', (statusCode: number, body: unknown, endpoint?: string) => {
  inviteGateSteps.stubRedeem(statusCode, body, endpoint);
});

Cypress.Commands.add('inviteGateRedeem', (code: string, tag?: string) => {
  inviteGateSteps.redeem(code, tag);
});

Cypress.Commands.add('inviteGateAssertError', (code: string, text?: string, tag?: string) => {
  inviteGateAsserts.error(code, text, tag);
});

export {};
