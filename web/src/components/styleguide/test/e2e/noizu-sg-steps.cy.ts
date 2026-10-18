/// <reference types="cypress" />
import {styleguideAsserts as asserts} from '../asserts';
import {styleguideSteps as steps} from '../steps';

describe('noizu-sg-steps (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('noizu-sg-steps');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('noizu-sg-steps');
    asserts.noLoadError();
    asserts.stepsVisible();
  });

  it('exposes a resolved current index', () => {
    steps.waitDefined('noizu-sg-steps');
    steps.setSteps(['Plan', 'Build', 'Ship']);
    // When the host sets current
    steps.setCurrent(1);
    // Then the list reflects the 0-based index
    asserts.stepsCurrent(1);
  });
});
