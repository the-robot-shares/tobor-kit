/// <reference types="cypress" />
import {voiceSessionAsserts as asserts} from '../asserts';
import {voiceSessionSteps as steps} from '../steps';

describe('tobor-voice-session (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads
    steps.waitDefined();
    // Then the tag is defined and the island is present
    asserts.mounted();
    asserts.noLoadError();
  });

  it('renders an idle mic and status', () => {
    // Given the element registered
    steps.waitDefined();
    // Then the mic is released and status is idle
    asserts.idle();
  });
});
