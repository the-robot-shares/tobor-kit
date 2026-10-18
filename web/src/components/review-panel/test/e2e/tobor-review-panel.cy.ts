/// <reference types="cypress" />
import {reviewPanelAsserts as asserts} from '../asserts';
import {reviewPanelSteps as steps} from '../steps';

describe('tobor-review-panel (live host)', () => {
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
    asserts.panel();
  });

  it('exposes composer hooks when show-composer is on', () => {
    // Given the custom element is defined
    steps.waitDefined();
    cy.get('tobor-review-panel').then(($el) => {
      const host = $el[0] as HTMLElement & {showComposer: boolean};
      if (!host.showComposer && $el[0].getAttribute('show-composer') === 'false') {
        asserts.panel();
        return;
      }
      // Then composer + submit hooks exist (default true)
      asserts.composer();
    });
  });

  it('renders the empty state on a bare unconfigured mount', () => {
    // Given a page that loads the tag with no properties
    steps.waitDefined();
    steps.captureErrors();
    // Then it renders without throwing and shows its empty state
    asserts.mounted();
    asserts.noLoadError();
    asserts.panel();
    asserts.emptyState();
    asserts.composer();
    asserts.noRenderErrors();
  });

  it('survives a host assigning reviews = undefined', () => {
    // Given the island is mounted with error capture armed
    steps.waitDefined();
    steps.captureErrors();
    // When the host clobbers the collection default (render re-runs)
    cy.get('tobor-review-panel').then(($el) => {
      const host = $el[0] as HTMLElement & {reviews: unknown};
      host.reviews = undefined;
    });
    // Lit reports render throws as unhandled rejections on the next tick —
    // hold the queue open so a crash cannot land after the test completes.
    cy.wait(500);
    // Then the render path normalizes and no crash escapes
    asserts.panel();
    asserts.emptyState();
    asserts.noLoadError();
    asserts.noRenderErrors();
  });
});
