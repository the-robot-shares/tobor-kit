/// <reference types="cypress" />
import {taskMenuAsserts as asserts} from '../asserts';
import {SAMPLE_INVENTORY, taskMenuSteps as steps} from '../steps';

describe('tobor-task-menu (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads
    steps.waitDefined();
    // Then the tag is defined and the island did not fail to load
    asserts.mounted();
    asserts.noLoadError();
  });

  it('lists server-dressed inventory when opened', () => {
    // Given a dressed GET /mcp/tools payload including degraded[]
    steps.waitDefined();
    steps.setInventory(SAMPLE_INVENTORY);
    // When the host opens the menu
    steps.open();
    // Then tools and degraded servers render verbatim
    asserts.open();
    asserts.toolVisible('Github.BranchCreate');
    asserts.toolVisible('Github.PullCreate');
    asserts.degradedVisible();
  });

  it('emits tobor-task-select immediately for non-confirm tools', () => {
    steps.waitDefined();
    steps.setInventory(SAMPLE_INVENTORY);
    steps.captureSelect();
    steps.open();
    // When a read-only-style tool is chosen
    steps.select('Github.BranchCreate');
    // Then tobor-task-select carries the contract Tool
    asserts.selected('Github.BranchCreate');
    asserts.closed();
  });

  it('requires confirmation for confirm-capable tools', () => {
    steps.waitDefined();
    steps.setInventory(SAMPLE_INVENTORY);
    steps.captureSelect();
    steps.open();
    // When a confirm:true tool is chosen
    steps.select('Github.PullCreate');
    // Then the island asks first and does not emit
    asserts.confirmPrompt();
    asserts.noSelection();
    // When the host confirms
    steps.confirm();
    // Then tobor-task-select fires
    asserts.selected('Github.PullCreate');
    asserts.closed();
  });

  it('shows an empty state and closes on Escape', () => {
    steps.waitDefined();
    steps.setInventory({groups: [], tools: [], degraded: []});
    steps.open();
    asserts.empty();
    steps.pressEscape();
    asserts.closed();
  });
});
