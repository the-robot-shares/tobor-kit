/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'tobor-telemetry-toggle';

export const telemetryToggleAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  noConsentError(tag = TAG): void {
    inShadow(tag, '[data-testid="telemetry-error"]').should('not.exist');
  },
  toggleVisible(tag = TAG): void {
    inShadow(tag, '[data-testid="telemetry-toggle"]').should('exist');
  },
  inert(tag = TAG): void {
    inShadow(tag, '[data-testid="telemetry-toggle"]').should('not.exist');
  },
  rendersNothingWhenNotOverridable(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const host = $el[0] as HTMLElement & {
        overridable: boolean;
        consent?: {source: string; user_overridable: boolean};
      };
      if (host.consent && !host.overridable) {
        cy.wrap(host.shadowRoot?.querySelector('[data-testid="telemetry-toggle"]')).should(
          'not.exist',
        );
      }
    });
  },
};
