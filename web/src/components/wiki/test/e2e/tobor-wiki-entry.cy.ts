/// <reference types="cypress" />
import {wikiAsserts as asserts} from '../asserts';
import {wikiSteps as steps} from '../steps';

describe('tobor-wiki-entry (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('tobor-wiki-entry');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('tobor-wiki-entry');
    asserts.noLoadError();
    asserts.entry();
  });

  it('keeps body markup as text when an entry is set', () => {
    steps.waitDefined('tobor-wiki-entry');
    cy.get('tobor-wiki-entry').then(($el) => {
      const host = $el[0] as HTMLElement & {entry?: {body?: string} | null};
      if (!host.entry?.body) {
        asserts.entry();
        return;
      }
      if (host.entry.body.includes('<')) {
        asserts.bodyIsText(host.entry.body.slice(0, 12));
      } else {
        asserts.bodyIsText(host.entry.body.slice(0, 12));
      }
    });
  });
});
