/// <reference types="cypress" />
import {voiceAgentAsserts as asserts} from '../asserts';
import {voiceAgentSteps as steps} from '../steps';

describe('tobor-voice-agent (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the tag
    steps.waitDefined();
    // Then the island is present without catalog load errors
    asserts.mounted();
    asserts.noLoadError();
  });

  it('shows connect controls while disconnected', () => {
    steps.waitDefined();
    // Then registry hooks agent-connect / agent-status are present
    asserts.connectVisible();
    asserts.statusIncludes('disconnected');
  });
});
