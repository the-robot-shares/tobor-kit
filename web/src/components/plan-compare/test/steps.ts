/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';
import type {Plan} from '../plans.js';

const TAG = 'noizu-plan-compare';

const SAMPLE: Plan[] = [
  {id: 'starter', name: 'Starter', priceMonthly: 9, priceYearly: 90, features: ['1 seat']},
  {id: 'pro', name: 'Pro', priceMonthly: 29, priceYearly: 290, features: ['5 seats'], highlighted: true},
  {id: 'team', name: 'Team', priceMonthly: 99, priceYearly: 990, features: ['Unlimited seats']},
];

export const planCompareSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureSelects(): void {
    cy.window().then((win) => {
      const state = win as Window & {
        __planSelect?: {planId: string; checkoutUrl: string; interval: string};
      };
      win.document.addEventListener('plan-select', (event) => {
        state.__planSelect = (event as CustomEvent).detail;
      });
    });
  },
  ensurePlans(plans: Plan[] = SAMPLE): void {
    cy.get(TAG).then(($el) => {
      const node = $el.get(0) as HTMLElement & {plans: Plan[]};
      node.plans = plans;
    });
    inShadow(TAG, '[data-cy="plan.card"]').should('have.length', plans.length);
  },
  enableBillingToggle(): void {
    cy.get(TAG).then(($el) => {
      $el.get(0).setAttribute('billing-toggle', '');
    });
    inShadow(TAG, '[data-cy="plan.toggle"]').should('exist');
  },
  setCheckoutTemplate(template: string): void {
    cy.get(TAG).then(($el) => {
      const node = $el.get(0) as HTMLElement & {checkoutUrlTemplate: string};
      node.checkoutUrlTemplate = template;
    });
  },
  toggleBilling(): void {
    inShadow(TAG, '[data-cy="plan.toggle"]').click();
  },
  clickCta(planId = 'starter'): void {
    inShadow(TAG, `[data-cy="plan.cta"][data-plan-id="${planId}"]`).click();
  },
};
