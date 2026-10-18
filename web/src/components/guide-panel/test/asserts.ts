/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';
import {TAG} from './steps';

export const guidePanelAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  inDemoFrame(tag = TAG): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  ready(tag = TAG): void {
    inShadow(tag, '[data-testid="panel-loading"]').should('not.exist');
    inShadow(tag, '[part="panel"]').should('exist');
    inShadow(
      tag,
      '[data-testid="expand"], [data-testid="collapse"], [data-testid="panel-error"]',
    ).should('exist');
  },
  expanded(tag = TAG): void {
    inShadow(tag, '[data-testid="collapse"]').should('exist');
  },
  placement(value: 'floating' | 'docked' | 'inline', tag = TAG): void {
    cy.get(tag).should('have.attr', 'placement', value);
  },
};
