/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

const TAG = 'tobor-chat-thread';

export const chatThreadSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  setPending(value: string, tag = TAG): void {
    cy.get(tag).invoke('attr', 'pending', value);
  },
  typeComposer(value: string, tag = TAG): void {
    inShadow(tag, '[data-cy="thread.composer"]').clear().type(value);
  },
  send(tag = TAG): void {
    inShadow(tag, '[data-cy="thread.send"]').click();
  },
  captureSend(): void {
    cy.window().then((win) => {
      const state = win as Window & {__threadSend?: {text: string}};
      win.document.addEventListener('thread-send', (event) => {
        state.__threadSend = (event as CustomEvent<{text: string}>).detail;
      });
    });
  },
};
