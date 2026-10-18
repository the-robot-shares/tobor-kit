/// <reference types="cypress" />
import {personaAsserts as asserts} from '../asserts.js';
import {personaSteps as steps} from '../steps.js';

describe('tobor-persona-card (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined('tobor-persona-card');
    asserts.mounted('tobor-persona-card');
    asserts.noLoadError();
    asserts.cardVisible();
  });

  it('emits persona-select when Select is clicked', () => {
    steps.waitDefined('tobor-persona-card');
    asserts.cardVisible();
    steps.captureSelect();
    // When the visitor clicks Select
    steps.clickSelect();
    // Then the host receives persona-select (host switches persona)
    cy.get('tobor-persona-card').then(($el) => {
      const id = ($el.get(0) as HTMLElement & {personaId: string}).personaId;
      asserts.lastSelect(id);
    });
  });
});
