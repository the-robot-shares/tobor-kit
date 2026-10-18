/// <reference types="cypress" />
import {inShadow, waitDefined as waitCustomElementDefined} from '../../../lit-test/cypress.js';

export const TAG = 'tobor-voice-session';

export const voiceSessionSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitCustomElementDefined(tag, timeout);
  },
  toggle(tag = TAG): void {
    inShadow(tag, '[data-testid="voice-mic"]').click();
  },
  start(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {start(): Promise<void>};
      return node.start();
    });
  },
  stop(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {stop(): Promise<void>};
      return node.stop();
    });
  },
  sendText(text: string, tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {sendText(value: string): void};
      node.sendText(text);
    });
  },
};
