/// <reference types="cypress" />
import {mcpConfigAsserts as asserts} from '../asserts';
import {mcpConfigSteps as steps} from '../steps';

describe('tobor-mcp-config (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    asserts.form();
  });

  it('emits config-change on save', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.captureChanges();
    steps.setUrl('https://mcp.example.test/mcp');
    steps.setTransport('sse');
    steps.save();
    asserts.lastConfigChange({url: 'https://mcp.example.test/mcp', transport: 'sse'});
  });
});
