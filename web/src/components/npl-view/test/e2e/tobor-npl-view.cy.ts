/// <reference types="cypress" />
import {nplViewAsserts as asserts} from '../asserts';
import {NPL_VIEW_SAMPLE, nplViewSteps as steps} from '../steps';

describe('tobor-npl-view (live host)', () => {
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
    asserts.viewVisible();
  });

  it('folds headings and emits npl-copy for the current source', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.setSource(NPL_VIEW_SAMPLE);
    asserts.hasFolds();
    steps.captureCopy();
    // When the host copies the source
    steps.copy();
    // Then the host receives {text}
    asserts.lastCopy({text: NPL_VIEW_SAMPLE});
  });
});
