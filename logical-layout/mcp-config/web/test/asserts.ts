/// <reference types="cypress" />
import {assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';

const TAG = 'tobor-mcp-config';

export const mcpConfigAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  form(tag = TAG): void {
    inShadow(tag, '[data-cy="mcp.config"]').should('exist');
    inShadow(tag, '[data-cy="mcp.save"]').should('exist');
  },
  lastConfigChange(
    expected: {url: string; transport: string},
    tag = TAG,
  ): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {
        __configChanges?: {url: string; transport: string}[];
      }).__configChanges;
      expect(log, 'config-change log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.include(expected);
    });
  },
};
