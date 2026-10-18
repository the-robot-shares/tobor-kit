/// <reference types="cypress" />
import {styleguideAsserts as asserts} from '../asserts';
import {styleguideSteps as steps} from '../steps';

describe('noizu-sg-card (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('noizu-sg-card');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('noizu-sg-card');
    asserts.noLoadError();
    asserts.cardVisible();
  });

  it('emits sg-card-select from the card surface', () => {
    // Given the custom element is defined
    steps.waitDefined('noizu-sg-card');
    steps.captureCardSelect();
    // When the visitor activates the card
    steps.clickCard();
    // Then the host receives sg-card-select (host owns navigation)
    cy.get('noizu-sg-card').should(($el) => {
      const log = ($el[0] as HTMLElement & {__sgCardSelect?: {href: string}[]}).__sgCardSelect;
      expect(log, 'sg-card-select log').to.be.an('array').that.is.not.empty;
    });
  });
});
