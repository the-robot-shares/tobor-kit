/// <reference types="cypress" />
import {planCompareAsserts as asserts} from '../asserts.js';
import {planCompareSteps as steps} from '../steps.js';

describe('noizu-plan-compare (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
  });

  it('emits plan-select with an interpolated checkout URL', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.captureSelects();
    steps.ensurePlans();
    steps.setCheckoutTemplate('https://example.com/checkout/{planId}');
    steps.clickCta('pro');
    asserts.lastSelect({
      planId: 'pro',
      checkoutUrl: 'https://example.com/checkout/pro',
      interval: 'monthly',
    });
  });

  it('billing toggle switches displayed price', () => {
    steps.waitDefined();
    steps.ensurePlans();
    steps.enableBillingToggle();
    asserts.interval('monthly');
    steps.toggleBilling();
    asserts.interval('yearly');
  });
});
