/// <reference types="cypress" />
import {styleguideAsserts as asserts} from '../asserts';
import {styleguideSteps as steps} from '../steps';

describe('noizu-sg-btn (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('noizu-sg-btn');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('noizu-sg-btn');
    asserts.noLoadError();
    asserts.btnVisible();
  });

  it('emits sg-click from the button', () => {
    // Given the custom element is defined
    steps.waitDefined('noizu-sg-btn');
    steps.captureSgClick();
    // When the visitor clicks the button
    steps.clickBtn();
    // Then the host receives sg-click
    asserts.sgClickFired();
  });
});
