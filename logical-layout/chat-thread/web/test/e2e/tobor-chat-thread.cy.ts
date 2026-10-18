/// <reference types="cypress" />
import {chatThreadAsserts as asserts} from '../asserts';
import {chatThreadSteps as steps} from '../steps';

describe('tobor-chat-thread (live host)', () => {
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

  it('composes transcript-view inside thread.root', () => {
    steps.waitDefined();
    asserts.root();
    asserts.composedTranscript();
  });

  it('exposes composer hooks when show-composer is on', () => {
    steps.waitDefined();
    cy.get('tobor-chat-thread').then(($el) => {
      const host = $el[0] as HTMLElement & {showComposer: boolean};
      if (!host.showComposer && !$el[0].hasAttribute('show-composer')) {
        asserts.root();
        return;
      }
      asserts.composer();
    });
  });
});
