/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

export const loginFlowAsserts = {
  mounted(tag = 'tobor-login-flow'): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  promptOrSession(tag = 'tobor-login-flow'): void {
    inShadow(tag, '[data-testid="login-button"], [data-testid="login-user"]').should('exist');
  },
  signInVisible(tag = 'tobor-login-flow'): void {
    inShadow(tag, '[data-testid="login-button"]').should('be.visible');
  },
  signedIn(tag = 'tobor-login-flow'): void {
    inShadow(tag, '[data-testid="login-user"]').should('contain', 'Signed in');
  },
  errorVisible(tag = 'tobor-login-flow'): void {
    inShadow(tag, '[data-testid="login-error"]').should('be.visible');
  },
};
