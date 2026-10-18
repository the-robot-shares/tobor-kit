/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';
import {TAG} from './steps';

export const voiceSessionAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  inDemoFrame(tag = TAG): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  idle(tag = TAG): void {
    inShadow(tag, '[data-testid="voice-mic"]')
      .should('exist')
      .and('have.attr', 'aria-pressed', 'false');
    inShadow(tag, '[data-testid="voice-status"]').should('have.attr', 'data-state', 'idle');
  },
  state(state: string, tag = TAG): void {
    inShadow(tag, '[data-testid="voice-status"]').should('have.attr', 'data-state', state);
  },
  micPressed(pressed: boolean, tag = TAG): void {
    inShadow(tag, '[data-testid="voice-mic"]').should(
      'have.attr',
      'aria-pressed',
      pressed ? 'true' : 'false',
    );
  },
};
