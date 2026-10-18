/// <reference types="cypress" />
import {styleguideAsserts as asserts} from '../asserts';
import {styleguideSteps as steps} from '../steps';

describe('noizu-sg-status (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('noizu-sg-status');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('noizu-sg-status');
    asserts.noLoadError();
    asserts.statusVisible();
  });

  it('exposes a resolved status tone', () => {
    steps.waitDefined('noizu-sg-status');
    cy.get('noizu-sg-status').then(($el) => {
      ($el[0] as HTMLElement).setAttribute('status', 'ok');
    });
    asserts.statusKind('ok');
  });
});
