/// <reference types="cypress" />

import {toolListAsserts as asserts} from '../asserts';
import {toolListSteps as steps} from '../steps';

describe('tobor-tool-list (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
  });

  it('renders inventory and emits tobor-tool-select', () => {
    // Given a dressed GET /mcp/tools payload including degraded[]
    steps.waitDefined();
    steps.setInventory();
    steps.captureSelect();
    asserts.degraded();
    asserts.listsTool('Github.BranchCreate');
    asserts.listsTool('Ticket.Create');
    asserts.descriptionVisible('Open a ticket');
    // When a tool row is clicked
    steps.selectTool('Ticket.Create');
    // Then tobor-tool-select carries the contract Tool
    asserts.selectedTool('Ticket.Create');
  });

  it('hides descriptions when showDescriptions is false', () => {
    steps.waitDefined();
    steps.setInventory();
    steps.setShowDescriptions(false);
    asserts.descriptionHidden();
  });
});
