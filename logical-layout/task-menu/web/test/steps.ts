/// <reference types="cypress" />
import {inShadow, waitDefined as waitTagDefined} from '../../../lit-test/cypress.js';

export const TAG = 'tobor-task-menu';

export type ToolInventoryFixture = {
  groups: {id: string; label: string}[];
  tools: {
    name: string;
    label: string;
    group: string;
    description?: string;
    confirm?: boolean;
  }[];
  degraded?: {server?: string; label?: string; error?: string}[];
};

export const SAMPLE_INVENTORY: ToolInventoryFixture = {
  groups: [{id: 'Github', label: 'Github'}],
  tools: [
    {name: 'Github.BranchCreate', label: 'New branch', group: 'Github'},
    {name: 'Github.PullCreate', label: 'Open a PR', group: 'Github', confirm: true},
  ],
  degraded: [{server: 'tickets', label: 'Tickets', error: 'timeout'}],
};

export const taskMenuSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitTagDefined(tag, timeout);
  },
  setInventory(inventory: ToolInventoryFixture, tag = TAG): void {
    cy.get(tag).then(async ($el) => {
      const el = $el[0] as HTMLElement & {
        inventory?: unknown;
        updateComplete?: Promise<unknown>;
      };
      el.inventory = inventory;
      await el.updateComplete;
    });
  },
  open(tag = TAG): void {
    inShadow(tag, '[data-testid="task-menu-trigger"]').click();
  },
  select(name: string, tag = TAG): void {
    inShadow(tag, `[data-tool="${name}"]`).click();
  },
  confirm(tag = TAG): void {
    inShadow(tag, '[data-testid="task-confirm-yes"]').click();
  },
  pressEscape(tag = TAG): void {
    inShadow(tag, '[data-testid="task-menu-panel"]').trigger('keydown', {key: 'Escape'});
  },
  captureSelect(tag = TAG): void {
    cy.window().then((win) => {
      (win as Window & {__taskSelect?: {tool?: {name: string}} | null}).__taskSelect = null;
      cy.get(tag).then(($el) => {
        $el[0].addEventListener('tobor-task-select', (event: Event) => {
          (win as Window & {__taskSelect?: unknown}).__taskSelect = (event as CustomEvent).detail;
        });
      });
    });
  },
};
