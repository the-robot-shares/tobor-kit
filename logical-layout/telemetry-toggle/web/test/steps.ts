/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

const TAG = 'tobor-telemetry-toggle';

export const telemetryToggleSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  waitReady(tag = TAG, timeout = 15_000): void {
    cy.get(tag, {timeout}).should(($el) => {
      const host = $el[0] as HTMLElement & {client?: unknown; consent?: unknown};
      const err = host.shadowRoot?.querySelector('[data-testid="telemetry-error"]');
      const ready = Boolean(host.consent) || Boolean(err) || !host.client;
      expect(ready, 'consent resolved or no client').to.eq(true);
    });
  },
  clickToggle(tag = TAG): void {
    inShadow(tag, '[data-testid="telemetry-toggle"]').click();
  },
};
