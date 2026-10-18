/// <reference types="cypress" />
import {waitlistAsserts as asserts} from '../asserts';
import {waitlistSteps as steps} from '../steps';

describe('noizu-waitlist (live host)', () => {
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

  it('accepts an email in the signup form', () => {
    // Given the custom element is defined
    steps.waitDefined();
    asserts.formReady();
    // When a visitor types an email
    steps.fillEmail('visitor@example.com');
    // Then the registry email hook holds the value
    asserts.emailValue('visitor@example.com');
  });
});
