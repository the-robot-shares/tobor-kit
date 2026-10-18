/// <reference types="cypress" />
import {transcriptViewAsserts as asserts} from '../asserts';
import {transcriptViewSteps as steps} from '../steps';

describe('tobor-transcript-view (live host)', () => {
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

  it('shows empty, log, or not-server-backed', () => {
    // Given the custom element is defined
    steps.waitDefined();
    // Then one of the three render states is visible (501 is not empty)
    asserts.visibleState();
  });

  it('shows streaming pending text when the host sets pending', () => {
    steps.waitDefined();
    cy.get('tobor-transcript-view').then(($el) => {
      const host = $el[0] as HTMLElement & {pending: string; load?: {status: string} | null};
      if (host.load?.status === 'not_server_backed') {
        asserts.notServerBacked();
        return;
      }
      steps.setPending('working on it…');
      asserts.pending();
    });
  });
});
