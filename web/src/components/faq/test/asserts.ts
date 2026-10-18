/// <reference types="cypress" />
import {assertMounted, assertNoLoadError, byCy} from '../../../lit-test/cypress.js';

export const faqAsserts = {
  mounted(tag = 'noizu-faq'): void {
    assertMounted(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  list(): void {
    byCy('faq.list').should('exist');
  },
  itemCountAtLeast(n: number): void {
    byCy('faq.item').should('have.length.at.least', n);
  },
  itemOpen(index: number): void {
    byCy('faq.item').eq(index).should('have.prop', 'open', true);
  },
  onlyItemOpen(index: number): void {
    byCy('faq.item').each(($el, i) => {
      expect(($el[0] as HTMLDetailsElement).open).to.equal(i === index);
    });
  },
  lastToggle(expected: {open: boolean; index: number}, tag = 'noizu-faq'): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__faqToggles?: {open: boolean; index: number}[]})
        .__faqToggles;
      expect(log, 'faq-toggle log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.include(expected);
    });
  },
};
