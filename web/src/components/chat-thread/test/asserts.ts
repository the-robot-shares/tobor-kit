/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'tobor-chat-thread';

export const chatThreadAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  root(tag = TAG): void {
    inShadow(tag, '[data-cy="thread.root"]').should('exist');
  },
  composedTranscript(tag = TAG): void {
    cy.get(tag).shadow().find('tobor-transcript-view').should('exist');
  },
  composer(tag = TAG): void {
    inShadow(tag, '[data-cy="thread.composer"]').should('exist');
    inShadow(tag, '[data-cy="thread.send"]').should('exist');
  },
  lastSend(text: string): void {
    cy.window().its('__threadSend').should('deep.equal', {text});
  },
};
