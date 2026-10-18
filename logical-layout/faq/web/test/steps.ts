/// <reference types="cypress" />
import {byCy, waitDefined as waitCustomElement} from '../../../lit-test/cypress.js';

export type FaqMode = 'many' | 'one';

export const faqSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-faq', timeout = 15_000): void {
    waitCustomElement(tag, timeout);
  },
  setMode(mode: FaqMode, tag = 'noizu-faq'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {mode: FaqMode};
      node.mode = mode;
      node.setAttribute('mode', mode);
    });
  },
  openItem(index: number): void {
    byCy('faq.trigger').eq(index).click();
  },
  captureToggles(tag = 'noizu-faq'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {__faqToggles?: {open: boolean; index: number}[]};
      const log: {open: boolean; index: number}[] = [];
      node.__faqToggles = log;
      node.addEventListener('faq-toggle', (event) => {
        log.push((event as CustomEvent<{open: boolean; index: number}>).detail);
      });
    });
  },
};
