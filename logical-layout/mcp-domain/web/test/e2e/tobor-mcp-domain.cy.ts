/// <reference types="cypress" />
import {mcpDomainAsserts as asserts} from '../asserts';
import {mcpDomainSteps as steps} from '../steps';

describe('tobor-mcp-domain (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    asserts.domain();
  });

  it('emits tool-visibility-change when a select changes', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.captureChanges();
    steps.setTools();
    steps.setVisibility('Github.PullCreate', 'discoverable');
    asserts.lastVisibilityChange({name: 'Github.PullCreate', visibility: 'discoverable'});
  });
});
