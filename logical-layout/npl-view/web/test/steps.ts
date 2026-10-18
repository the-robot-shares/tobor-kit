/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

const TAG = 'tobor-npl-view';

export const NPL_VIEW_SAMPLE = `⌜NPL@1.0⌝

# Syntax
Greet {user.name} with [...:1sentence| warm].
`;

export const nplViewSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  setSource(source: string = NPL_VIEW_SAMPLE, tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {source: string};
      node.source = source;
    });
  },
  captureCopy(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {__copies?: {text: string}[]};
      node.__copies = [];
      node.addEventListener('npl-copy', (event) => {
        node.__copies?.push((event as CustomEvent<{text: string}>).detail);
      });
    });
  },
  copy(tag = TAG): void {
    inShadow(tag, '[data-cy="npl.copy"]').click();
  },
  toggleFold(index = 0, tag = TAG): void {
    inShadow(tag, '[data-cy="npl.fold"]').eq(index).click();
  },
};
