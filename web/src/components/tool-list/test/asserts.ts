/// <reference types="cypress" />

import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';
import {TAG} from './steps';

export const toolListAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  unavailable(tag = TAG): void {
    inShadow(tag, '[data-testid="tools-unavailable"]').should('contain', 'Tools unavailable');
  },
  empty(tag = TAG): void {
    inShadow(tag, '[data-testid="tools-empty"]').should('exist');
  },
  degraded(server = 'seo', tag = TAG): void {
    inShadow(tag, '[data-testid="degraded-servers"]').should('be.visible');
    inShadow(tag, `li[data-server="${server}"]`).should('contain', 'connection refused');
  },
  listsTool(name: string, tag = TAG): void {
    inShadow(tag, `[data-tool="${name}"]`).should('exist');
  },
  descriptionVisible(text: string, tag = TAG): void {
    inShadow(tag, '.desc').should('contain', text);
  },
  descriptionHidden(tag = TAG): void {
    inShadow(tag, 'button.tool').should('exist');
    cy.get(tag).shadow().find('.desc').should('not.exist');
  },
  selectedTool(name: string): void {
    cy.window().should((win) => {
      const detail = (win as Window & {__toolSelect?: {tool?: {name?: string}}}).__toolSelect;
      expect(detail?.tool?.name).to.equal(name);
    });
  },
};
