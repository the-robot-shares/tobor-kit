/// <reference types="cypress" />
import {inShadow, waitDefined as waitDefinedHelper} from '../../../lit-test/cypress.js';

export const TAG = 'tobor-voice-agent';

export function control(id: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return inShadow(TAG, `[data-testid="agent-${id}"]`);
}

export const voiceAgentSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefinedHelper(tag, timeout);
  },
  connect(): void {
    control('connect').click();
  },
  disconnect(): void {
    control('disconnect').click();
  },
  sendText(text: string): void {
    control('input').clear().type(text);
    control('send').click();
  },
  interrupt(): void {
    control('interrupt').click();
  },
  openOptions(): void {
    control('options').click();
  },
};
