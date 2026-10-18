/// <reference types="cypress" />
import {assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';

const TAG = 'tobor-mcp-clients';

export const mcpClientsAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  list(tag = TAG): void {
    inShadow(tag, '[data-cy="mcp.clients"]').should('exist');
  },
  lastAuthorize(expected: {id: string}, tag = TAG): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__authorizes?: {id: string}[]}).__authorizes;
      expect(log, 'client-authorize log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.deep.equal(expected);
    });
  },
  lastRevoke(expected: {id: string}, tag = TAG): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__revokes?: {id: string}[]}).__revokes;
      expect(log, 'client-revoke log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.deep.equal(expected);
    });
  },
};
