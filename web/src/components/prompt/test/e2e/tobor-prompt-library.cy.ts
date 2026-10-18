/// <reference types="cypress" />
import {promptAsserts as asserts} from '../asserts';
import {promptSteps as steps} from '../steps';

describe('tobor-prompt-library (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('tobor-prompt-library');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('tobor-prompt-library');
    asserts.noLoadError();
    asserts.library();
  });

  it('filters the list and emits prompt-select / prompt-star', () => {
    steps.waitDefined('tobor-prompt-library');
    asserts.library();
    steps.ensurePrompts();
    asserts.itemCount(2);
    steps.typeQuery('brief');
    asserts.itemCount(1);
    steps.captureSelect();
    steps.captureStar();
    // When the visitor clicks a filtered item
    steps.clickItem('brief');
    // Then the host receives prompt-select
    asserts.lastSelect('brief');
    steps.typeQuery('sys');
    asserts.itemCount(1);
    // When the visitor toggles star
    steps.clickStar('sys');
    asserts.lastStar({id: 'sys', starred: false});
  });
});
