/// <reference types="cypress" />
import {telemetryToggleAsserts as asserts} from '../asserts';
import {telemetryToggleSteps as steps} from '../steps';

describe('tobor-telemetry-toggle (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined();
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted();
    asserts.noLoadError();
  });

  it('renders nothing when consent is not overridable', () => {
    // Given the custom element is defined
    steps.waitDefined();
    steps.waitReady();
    // Then a binding default never shows a dead checkbox
    asserts.noConsentError();
    asserts.rendersNothingWhenNotOverridable();
  });

  it('emits tobor-telemetry-change when an overridable toggle is flipped', () => {
    // Given resolved consent
    steps.waitDefined();
    steps.waitReady();
    cy.get('tobor-telemetry-toggle').then(($el) => {
      const host = $el[0] as HTMLElement & {overridable: boolean};
      if (!host.overridable) {
        // Then the island stays inert (forced / not overridable)
        asserts.inert();
        return;
      }
      host.addEventListener('tobor-telemetry-change', cy.stub().as('telemetryChange'));
      // When the user flips the control
      steps.clickToggle();
      // Then tobor-telemetry-change carries consent (200 or 403 revert)
      cy.get('@telemetryChange').should('have.been.called');
    });
  });
});
