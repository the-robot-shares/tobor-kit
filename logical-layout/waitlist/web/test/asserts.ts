/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  byCy,
} from '../../../lit-test/cypress.js';

export const waitlistAsserts = {
  mounted(tag = 'noizu-waitlist'): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = 'noizu-waitlist'): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  formReady(): void {
    byCy('waitlist.form').should('exist');
    byCy('waitlist.email').should('be.visible');
    byCy('waitlist.submit').should('be.visible');
    byCy('waitlist.status').should('exist');
  },
  emailValue(value: string): void {
    byCy('waitlist.email').should('have.value', value);
  },
  success(): void {
    byCy('waitlist.status').should('be.visible');
    cy.get('.success').should('exist');
  },
};
