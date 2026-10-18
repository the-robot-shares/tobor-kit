/// <reference types="cypress" />
import {waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';

const TAG = 'tobor-robot-avatar';

export const robotAvatarSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  setState(state: string, tag = TAG): void {
    cy.get(tag).invoke('attr', 'state', state);
  },
  setReducedMotion(policy: string, tag = TAG): void {
    cy.get(tag).invoke('attr', 'reduced-motion', policy);
  },
  setRenderer(renderer: string, tag = TAG): void {
    cy.get(tag).invoke('attr', 'renderer', renderer);
  },
};
