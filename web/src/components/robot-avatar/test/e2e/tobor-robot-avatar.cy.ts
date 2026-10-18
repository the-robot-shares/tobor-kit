/// <reference types="cypress" />
import {robotAvatarAsserts as asserts} from '../asserts.js';
import {robotAvatarSteps as steps} from '../steps.js';

describe('tobor-robot-avatar (live host)', () => {
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

  it('renders the state the host sets', () => {
    steps.waitDefined();
    asserts.mounted();
    // When the host tells it to listen
    steps.setState('listening');
    // Then it reflects data-state; it never infers
    asserts.state('listening');
  });

  it('honours reduced-motion=force_static', () => {
    steps.waitDefined();
    asserts.mounted();
    // When the host forces a static glyph
    steps.setReducedMotion('force_static');
    // Then motion resolves to static
    asserts.motion('static');
  });
});
