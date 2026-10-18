/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError as kitNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const TAG = 'noizu-footer-brand';

export const footerBrandAsserts = {
  mounted(tag = TAG): void {
    assertMounted(tag);
  },
  catalogMounted(tag = TAG): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    kitNoLoadError();
  },
  brandText(text: string): void {
    inShadow(TAG, 'a[data-cy="footer-brand-link"]').should('have.text', text);
  },
  linkHref(href: string): void {
    inShadow(TAG, 'a[data-cy="footer-brand-link"]').should('have.attr', 'href', href);
  },
  blankRel(): void {
    inShadow(TAG, 'a[data-cy="footer-brand-link"]').should(
      'have.attr',
      'rel',
      'noopener noreferrer',
    );
  },
};
