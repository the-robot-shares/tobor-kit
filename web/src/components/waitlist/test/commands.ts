/// <reference types="cypress" />
import {waitlistAsserts} from './asserts';
import {waitlistSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      waitlistVisit(path?: string): void;
      waitlistWaitDefined(tag?: string, timeout?: number): void;
      waitlistMount(tag?: string): void;
      waitlistNoLoadError(): void;
      waitlistFillEmail(value: string): void;
      waitlistSubmit(): void;
      waitlistFormReady(): void;
      waitlistSuccess(): void;
    }
  }
}

Cypress.Commands.add('waitlistVisit', (path = '/') => {
  waitlistSteps.visit(path);
});

Cypress.Commands.add('waitlistWaitDefined', (tag?: string, timeout?: number) => {
  waitlistSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('waitlistMount', (tag = 'noizu-waitlist') => {
  waitlistSteps.waitDefined(tag);
  waitlistAsserts.mounted(tag);
});

Cypress.Commands.add('waitlistNoLoadError', () => {
  waitlistAsserts.noLoadError();
});

Cypress.Commands.add('waitlistFillEmail', (value: string) => {
  waitlistSteps.fillEmail(value);
});

Cypress.Commands.add('waitlistSubmit', () => {
  waitlistSteps.submit();
});

Cypress.Commands.add('waitlistFormReady', () => {
  waitlistAsserts.formReady();
});

Cypress.Commands.add('waitlistSuccess', () => {
  waitlistAsserts.success();
});

export {};
