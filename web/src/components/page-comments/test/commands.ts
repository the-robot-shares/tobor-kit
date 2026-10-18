/// <reference types="cypress" />
import {pageCommentsAsserts as asserts} from '../asserts';
import {pageCommentsSteps as steps} from '../steps';

// Cypress.Commands wrappers so a host suite can
// `import '.../page-comments/test/commands'` and call cy.pageComments*().

Cypress.Commands.add('pageCommentsMount', (path = '/demo/page-comments.html') => {
  steps.visit(path);
  steps.waitDefined();
  asserts.mounted();
  asserts.noLoadError();
});

Cypress.Commands.add('pageCommentsEnable', () => {
  steps.enable();
  steps.rail().should('be.visible');
});

Cypress.Commands.add('pageCommentsNoLoadError', () => {
  asserts.noLoadError();
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      pageCommentsMount(path?: string): Chainable;
      pageCommentsEnable(): Chainable;
      pageCommentsNoLoadError(): Chainable;
    }
  }
}
