/// <reference types="cypress" />
import {guidePanelAsserts as asserts} from '../asserts';
import {guidePanelSteps as steps} from '../steps';

describe('tobor-guide-panel (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island against a Guide API
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads
    steps.waitDefined();
    // Then the tag is defined and visible, with no catalog load error
    asserts.mounted();
    asserts.noLoadError();
  });

  it('leaves loading and exposes panel chrome', () => {
    // Given the custom element is registered
    steps.waitDefined();
    asserts.mounted();
    // When GET /guide (or a provided guide property) resolves
    // Then loading copy is gone and expand/collapse/error chrome is present
    asserts.ready();
  });

  it('can expand and show a turn surface or error', () => {
    // Given a mounted panel
    steps.waitDefined();
    asserts.ready();
    // When the host opens the panel
    steps.expandIfCollapsed();
    // Then the expanded chrome or a guide-load error is shown
    cy.get('tobor-guide-panel')
      .shadow()
      .find('[data-testid="collapse"], [data-testid="panel-error"]')
      .should('exist');
  });
});
