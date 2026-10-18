/// <reference types="cypress" />
import {assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';

const TAG = 'tobor-mcp-domain';

export const mcpDomainAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  domain(tag = TAG): void {
    inShadow(tag, '[data-cy="mcp.domain"]').should('exist');
  },
  toolCount(count: number, tag = TAG): void {
    cy.get(tag).shadow().find('[data-cy="mcp.tool"]').should('have.length', count);
  },
  lastVisibilityChange(expected: {name: string; visibility: string}, tag = TAG): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {
        __visibilityChanges?: {name: string; visibility: string}[];
      }).__visibilityChanges;
      expect(log, 'tool-visibility-change log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.deep.equal(expected);
    });
  },
};
