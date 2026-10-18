/// <reference types="cypress" />
import {modelConfigAsserts as asserts} from '../asserts';
import {modelConfigSteps as steps} from '../steps';

describe('noizu-model-config (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    asserts.picker();
  });

  it('emits model-change when a catalog spec is selected', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.captureChanges();
    steps.ensureCatalog();
    steps.setValue('openai:gpt-4o');
    steps.selectSpec('anthropic:claude-3-5');
    asserts.lastModelChange({value: 'anthropic:claude-3-5'});
  });

  it('shows Inherit when inherit is enabled', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.setInherit(true);
    asserts.inheritOption(true);
  });
});
