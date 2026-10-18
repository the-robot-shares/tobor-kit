/// <reference types="cypress" />
import {wikiAsserts as asserts} from '../asserts';
import {wikiSteps as steps} from '../steps';

describe('tobor-wiki-space (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('tobor-wiki-space');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('tobor-wiki-space');
    asserts.noLoadError();
    asserts.spaceList();
  });

  it('lists space items when the host supplied spaces', () => {
    steps.waitDefined('tobor-wiki-space');
    cy.get('tobor-wiki-space').then(($el) => {
      const host = $el[0] as HTMLElement & {spaces?: {id: string}[]};
      if (!host.spaces?.length) {
        asserts.spaceList();
        return;
      }
      asserts.spaceItems(host.spaces.length);
    });
  });
});
