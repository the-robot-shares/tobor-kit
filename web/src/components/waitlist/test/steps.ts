/// <reference types="cypress" />
import {byCy, waitDefined} from '../../../lit-test/cypress.js';

export const waitlistSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-waitlist', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  fillEmail(value: string): void {
    byCy('waitlist.email').clear().type(value);
  },
  submit(): void {
    byCy('waitlist.submit').click();
  },
};
