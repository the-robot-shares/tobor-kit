/// <reference types="cypress" />
import {billingStatusAsserts as asserts} from '../asserts';
import {billingStatusSteps as steps} from '../steps';

describe('noizu-billing-status (live host)', () => {
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
    asserts.statusVisible();
    asserts.portalVisible();
  });

  it('emits portal-open from Manage billing', () => {
    // Given the custom element is defined
    steps.waitDefined();
    steps.capturePortalOpen();
    // When the visitor clicks Manage billing
    steps.clickPortal();
    // Then the host receives portal-open (host opens Stripe portal)
    asserts.portalOpenFired();
  });
});
