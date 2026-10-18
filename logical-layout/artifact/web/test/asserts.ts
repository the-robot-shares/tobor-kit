/// <reference types="cypress" />
import {assertDemoFrameVisible, assertMounted, assertNoLoadError, inShadow} from '../../../lit-test/cypress.js';

const VIEW = 'tobor-artifact-view';
const EDITOR = 'tobor-artifact-editor';

export const artifactAsserts = {
  mounted(tag = VIEW): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = VIEW): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  viewVisible(): void {
    inShadow(VIEW, '[data-cy="artifact.view"]').should('exist');
  },
  editorVisible(): void {
    inShadow(EDITOR, '[data-cy="artifact.editor"]').should('exist');
  },
  bodyText(expected: string, tag = VIEW): void {
    inShadow(tag, 'pre[part="body"]').should('have.text', expected);
  },
  lastReview(expected: {artifactId: string; version: string | number}, tag = VIEW): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__reviews?: typeof expected[]}).__reviews;
      expect(log, 'review-start log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.deep.equal(expected);
    });
  },
  lastSave(
    expected: {id: string; title: string; body: string; version?: string | number},
    tag = EDITOR,
  ): void {
    cy.get(tag).should(($el) => {
      const log = ($el[0] as HTMLElement & {__saves?: typeof expected[]}).__saves;
      expect(log, 'artifact-save log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)).to.deep.equal(expected);
    });
  },
};
