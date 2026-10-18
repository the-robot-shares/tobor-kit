/// <reference types="cypress" />
import {configuratorAsserts as asserts} from '../asserts';
import {configuratorSteps as steps} from '../steps';

describe('tobor-configurator (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads
    steps.waitDefined();
    // Then the island is present without catalog load errors
    asserts.mounted();
    asserts.noLoadError();
  });

  it('renders form, preview, snippet and apply fires', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    asserts.form();
    asserts.preview();
    asserts.snippet();
    steps.captureApply();
    // When the host applies the current configuration
    steps.apply();
    // Then configurator-apply fired with a tag
    asserts.lastApply();
  });
});
