/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError as noLoadErrorHelper,
} from '../../../lit-test/cypress.js';
import {TAG, control} from './steps';

export const voiceAgentAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
    cy.get('body').then(($body) => {
      if ($body.find('.demo-frame').length) {
        assertDemoFrameVisible(tag);
      }
    });
  },
  noLoadError(): void {
    noLoadErrorHelper();
  },
  connectVisible(): void {
    control('connect').should('be.visible');
  },
  statusIncludes(text: string): void {
    control('status').should('contain', text);
  },
};
