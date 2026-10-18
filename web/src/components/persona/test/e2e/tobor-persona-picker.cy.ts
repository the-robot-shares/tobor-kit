/// <reference types="cypress" />
import {personaAsserts as asserts} from '../asserts.js';
import {personaSteps as steps} from '../steps.js';

describe('tobor-persona-picker (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined('tobor-persona-picker');
    asserts.mounted('tobor-persona-picker');
    asserts.noLoadError();
    asserts.pickerVisible();
  });

  it('filters the grid and emits persona-select from an item', () => {
    steps.waitDefined('tobor-persona-picker');
    asserts.pickerVisible();
    steps.ensurePersonas();
    asserts.itemCount(3);
    steps.typeQuery('orb');
    asserts.itemCount(1);
    steps.captureSelect();
    // When the visitor clicks a filtered item
    steps.clickItem('orbit');
    // Then the host receives persona-select (host switches persona)
    asserts.lastSelect('orbit');
  });
});
