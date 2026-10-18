/// <reference types="cypress" />
import {telemetryToggleAsserts} from './asserts';
import {telemetryToggleSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      telemetryToggleVisit(path?: string): void;
      telemetryToggleWaitDefined(tag?: string, timeout?: number): void;
      telemetryToggleMount(tag?: string): void;
      telemetryToggleNoLoadError(): void;
      telemetryToggleNoConsentError(tag?: string): void;
      telemetryToggleInert(tag?: string): void;
      telemetryToggleClick(tag?: string): void;
    }
  }
}

Cypress.Commands.add('telemetryToggleVisit', (path?: string) => {
  telemetryToggleSteps.visit(path);
});

Cypress.Commands.add('telemetryToggleWaitDefined', (tag?: string, timeout?: number) => {
  telemetryToggleSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('telemetryToggleMount', (tag?: string) => {
  telemetryToggleSteps.waitDefined(tag);
  telemetryToggleAsserts.mounted(tag);
});

Cypress.Commands.add('telemetryToggleNoLoadError', () => {
  telemetryToggleAsserts.noLoadError();
});

Cypress.Commands.add('telemetryToggleNoConsentError', (tag?: string) => {
  telemetryToggleAsserts.noConsentError(tag);
});

Cypress.Commands.add('telemetryToggleInert', (tag?: string) => {
  telemetryToggleAsserts.inert(tag);
});

Cypress.Commands.add('telemetryToggleClick', (tag?: string) => {
  telemetryToggleSteps.clickToggle(tag);
});

export {};
