/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';

const TAG = 'tobor-mode-toggle';

export const modeToggleSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureChanges(): void {
    cy.window().then((win) => {
      const state = win as Window & {
        __toborModeChange?: {mode: string; previous: string};
        __toborModeChanges?: {mode: string; previous: string}[];
      };
      state.__toborModeChanges = [];
      win.document.addEventListener('tobor-mode-change', (event) => {
        const detail = (event as CustomEvent<{mode: string; previous: string}>).detail;
        state.__toborModeChange = detail;
        state.__toborModeChanges?.push(detail);
      });
    });
  },
  ensureModes(modes: string[] = ['text', 'voice', 'transcript']): void {
    cy.get(TAG).then(($el) => {
      const node = $el.get(0) as HTMLElement & {modes: string[]};
      node.modes = modes;
    });
    inShadow(TAG, 'button[role="radio"]').should('have.length.at.least', modes.length);
  },
  selectMode(mode: string): void {
    inShadow(TAG, `button[data-mode="${mode}"]`).click();
  },
};
