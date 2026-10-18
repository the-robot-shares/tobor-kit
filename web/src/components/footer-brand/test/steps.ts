/// <reference types="cypress" />
import {waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';

const TAG = 'noizu-footer-brand';

export const footerBrandSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  setAttrs(attrs: Record<string, string>): void {
    cy.get(TAG).then(($el) => {
      const node = $el.get(0) as HTMLElement;
      for (const [name, value] of Object.entries(attrs)) {
        node.setAttribute(name, value);
      }
    });
  },
};
