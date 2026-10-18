/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

export const loginFlowSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'tobor-login-flow', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  clickSignIn(tag = 'tobor-login-flow'): void {
    inShadow(tag, '[data-testid="login-button"]').click();
  },
};
