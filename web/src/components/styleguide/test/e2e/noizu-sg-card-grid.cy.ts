/// <reference types="cypress" />
import {styleguideAsserts as asserts} from '../asserts';
import {styleguideSteps as steps} from '../steps';

describe('noizu-sg-card-grid (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('noizu-sg-card-grid');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('noizu-sg-card-grid');
    asserts.noLoadError();
    asserts.gridVisible();
  });

  it('exposes a resolved column count on the grid', () => {
    steps.waitDefined('noizu-sg-card-grid');
    // When the host sets columns
    steps.setColumns(2);
    // Then the grid reflects the track count
    asserts.gridColumns(2);
  });
});
