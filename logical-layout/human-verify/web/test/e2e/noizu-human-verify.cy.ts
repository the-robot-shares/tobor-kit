/// <reference types="cypress" />
import {humanVerifyAsserts as asserts} from '../asserts';
import {humanVerifySteps as steps} from '../steps';

describe('noizu-human-verify (live host)', () => {
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

  it('exposes verify.root and verify.widget in shadow DOM', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.hooks();
  });

  it('reset() re-emits verified for provider=none', () => {
    steps.waitDefined();
    asserts.mounted();
    // Given a listener on the island
    steps.captureVerified();
    // When the host calls reset()
    steps.reset();
    // Then verified fires with an empty token (host opted out — not proof)
    asserts.lastVerified({provider: 'none', token: ''});
  });
});
