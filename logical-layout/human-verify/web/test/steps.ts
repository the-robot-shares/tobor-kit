/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

const TAG = 'noizu-human-verify';

export const humanVerifySteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  reset(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {reset: () => void};
      node.reset();
    });
  },
  captureVerified(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {
        __verified?: {provider: string; token: string}[];
      };
      const log: {provider: string; token: string}[] = [];
      node.__verified = log;
      node.addEventListener('verified', (event) => {
        log.push((event as CustomEvent<{provider: string; token: string}>).detail);
      });
    });
  },
  setProvider(provider: string, tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {provider: string};
      node.provider = provider;
      node.setAttribute('provider', provider);
    });
  },
  widget(tag = TAG): Cypress.Chainable<JQuery<HTMLElement>> {
    return inShadow(tag, '[data-cy="verify.widget"]');
  },
};
