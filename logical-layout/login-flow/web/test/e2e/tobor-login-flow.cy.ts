/// <reference types="cypress" />
import {loginFlowAsserts as asserts} from '../asserts';
import {loginFlowSteps as steps} from '../steps';

describe('tobor-login-flow (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the document has loaded the module
    steps.waitDefined();
    // Then the tag is defined and the island is visible
    asserts.mounted();
    asserts.noLoadError();
  });

  it('shows a sign-in control or a signed-in session', () => {
    // Given the custom element is defined
    steps.waitDefined();
    // Then shadow UI is either the sign-in button or the signed-in label
    asserts.promptOrSession();
  });
});
