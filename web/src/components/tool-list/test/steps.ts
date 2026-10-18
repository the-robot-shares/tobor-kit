/// <reference types="cypress" />

import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

export const TAG = 'tobor-tool-list';

export const TOOL_LIST_SAMPLE_INVENTORY = {
  groups: [
    {id: 'Github', label: 'Github'},
    {id: 'Tickets', label: 'Tickets'},
  ],
  tools: [
    {
      name: 'Github.BranchCreate',
      label: 'New branch',
      group: 'Github',
      description: 'Create a branch',
      read_only: true,
    },
    {name: 'Github.PullCreate', label: 'Open a PR', group: 'Github', confirm: true},
    {name: 'Ticket.Create', label: 'File a ticket', group: 'Tickets', description: 'Open a ticket'},
  ],
  degraded: [
    {server: 'seo', error: 'connection refused'},
    {server: 'analytics'},
  ],
};

type ToolListEl = HTMLElement & {
  inventory?: unknown;
  showDescriptions?: boolean;
  updateComplete?: Promise<unknown>;
};

export const toolListSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  setInventory(inventory: unknown = TOOL_LIST_SAMPLE_INVENTORY, tag = TAG): void {
    cy.get(tag).then(($el) => {
      const el = $el[0] as ToolListEl;
      el.inventory = inventory;
      return el.updateComplete;
    });
  },
  setShowDescriptions(value: boolean, tag = TAG): void {
    cy.get(tag).then(($el) => {
      const el = $el[0] as ToolListEl;
      el.showDescriptions = value;
      return el.updateComplete;
    });
  },
  selectTool(name: string, tag = TAG): void {
    inShadow(tag, `[data-tool="${name}"]`).click();
  },
  captureSelect(tag = TAG): void {
    cy.get(tag).then(($el) => {
      cy.window().then((win) => {
        const state = win as Window & {__toolSelect?: unknown};
        state.__toolSelect = null;
        $el[0].addEventListener('tobor-tool-select', (event: Event) => {
          state.__toolSelect = (event as CustomEvent).detail;
        });
      });
    });
  },
};
