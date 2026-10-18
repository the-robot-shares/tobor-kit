/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'tobor-configurator';

export const configuratorAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  catalogMounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  form(tag = TAG): void {
    inShadow(tag, '[data-cy="configurator.form"]').should('exist');
  },
  preview(tag = TAG): void {
    inShadow(tag, '[data-cy="configurator.preview"]').should('exist');
  },
  snippet(tag = TAG): void {
    inShadow(tag, '[data-cy="configurator.snippet"]').should('exist');
  },
  field(name: string, tag = TAG): void {
    inShadow(tag, `[data-cy="configurator.field"][data-field="${name}"]`).should('exist');
  },
  lastApply(tag = TAG): void {
    cy.get(tag).should(($el) => {
      const log = (
        $el[0] as HTMLElement & {
          __configuratorApply?: {tag: string}[];
        }
      ).__configuratorApply;
      expect(log, 'configurator-apply log').to.be.an('array').that.is.not.empty;
      expect(log!.at(-1)?.tag).to.be.a('string').that.is.not.empty;
    });
  },
};
