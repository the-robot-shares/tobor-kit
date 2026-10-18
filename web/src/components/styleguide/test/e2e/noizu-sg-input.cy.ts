/// <reference types="cypress" />
import {styleguideAsserts as asserts} from '../asserts';
import {styleguideSteps as steps} from '../steps';

describe('noizu-sg-input (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('noizu-sg-input');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('noizu-sg-input');
    asserts.noLoadError();
    asserts.inputVisible();
  });

  it('emits sg-input from the field', () => {
    // Given the custom element is defined
    steps.waitDefined('noizu-sg-input');
    steps.captureSgInput();
    // When the visitor types
    steps.typeInput('hello');
    // Then the host receives sg-input {value}
    asserts.sgInputFired('hello');
  });
});
