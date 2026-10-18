/// <reference types="cypress" />
import {modeToggleAsserts as asserts} from '../asserts.js';
import {modeToggleSteps as steps} from '../steps.js';

describe('tobor-mode-toggle (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
  });

  it('emits tobor-mode-change when a mode is selected', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.captureChanges();
    steps.ensureModes(['text', 'voice', 'transcript']);
    steps.selectMode('voice');
    asserts.lastChange({mode: 'voice', previous: 'text'});
    asserts.activeMode('voice');
  });
});
