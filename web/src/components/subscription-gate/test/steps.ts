/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

export const subscriptionGateSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-subscription-gate', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  setEntitled(entitled: boolean, tag = 'noizu-subscription-gate'): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {entitled: boolean};
      node.entitled = entitled;
      if (entitled) node.setAttribute('entitled', '');
      else node.removeAttribute('entitled');
    });
  },
  clickUpgrade(tag = 'noizu-subscription-gate'): void {
    inShadow(tag, '[data-cy="gate.link"]').click();
  },
};
