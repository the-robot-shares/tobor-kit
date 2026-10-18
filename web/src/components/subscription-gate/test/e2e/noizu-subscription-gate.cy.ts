/// <reference types="cypress" />
import {subscriptionGateAsserts as asserts} from '../asserts';
import {subscriptionGateSteps as steps} from '../steps';

describe('noizu-subscription-gate (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined();
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted();
    asserts.noLoadError();
    asserts.root();
  });

  it('exposes blocked chrome or the entitled slot', () => {
    steps.waitDefined();
    asserts.root();
    cy.get('noizu-subscription-gate').then(($el) => {
      const node = $el[0] as HTMLElement & {entitled?: boolean};
      if (node.entitled) {
        asserts.entitled();
      } else {
        asserts.blocked();
        asserts.linkHref(node.getAttribute('redirect-to') || '/pricing');
      }
    });
  });
});
