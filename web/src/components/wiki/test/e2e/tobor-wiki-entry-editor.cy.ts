/// <reference types="cypress" />
import {wikiAsserts as asserts} from '../asserts';
import {wikiSteps as steps} from '../steps';

describe('tobor-wiki-entry-editor (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('tobor-wiki-entry-editor');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('tobor-wiki-entry-editor');
    asserts.noLoadError();
    asserts.editor();
  });

  it('exposes wiki.save', () => {
    steps.waitDefined('tobor-wiki-entry-editor');
    asserts.editor();
  });
});
