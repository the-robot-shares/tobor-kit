/// <reference types="cypress" />
import {assertDemoFrameVisible, assertMounted, assertNoLoadError, byCy} from '../../../lit-test/cypress.js';

const DEFAULT_STORAGE_KEY = 'start-app.cookie-consent.v1';

export const cookieAsserts = {
  mounted(tag = 'noizu-cookie-consent'): void {
    assertMounted(tag);
  },
  demoFrameVisible(tag = 'noizu-cookie-consent'): void {
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  bannerVisible(): void {
    byCy('cookie.banner').should('be.visible');
  },
  bannerHidden(): void {
    cy.get('[data-cy="cookie.banner"]').should('not.exist');
  },
  settingsVisible(): void {
    byCy('cookie.settings').should('be.visible');
  },
  categoriesVisible(count = 4): void {
    cy.get('[data-cy="cookie.category"]').should('have.length', count);
  },
  settingsOpenFired(): void {
    cy.get('@cookieSettingsOpen').should('have.been.called');
  },
  consentWritten(allOptional: boolean): void {
    cy.get('noizu-cookie-consent').should(($el) => {
      const el = $el[0] as HTMLElement & {storageKey?: string};
      const key = el.storageKey || el.getAttribute('storage-key') || DEFAULT_STORAGE_KEY;
      const raw = el.ownerDocument.defaultView?.localStorage.getItem(key) ?? null;
      expect(raw).to.be.a('string');
      const stored = JSON.parse(raw as string) as {
        version: number;
        categories: {
          necessary: boolean;
          analytics: boolean;
          marketing: boolean;
          preferences: boolean;
        };
        acceptedAt?: string;
        updatedAt?: string;
      };
      expect(stored.version).to.equal(1);
      expect(stored.categories.necessary).to.equal(true);
      expect(stored.categories.analytics).to.equal(allOptional);
      expect(stored.categories.marketing).to.equal(allOptional);
      expect(stored.categories.preferences).to.equal(allOptional);
      expect(stored.acceptedAt).to.be.a('string');
      expect(stored.updatedAt).to.be.a('string');
    });
  },
};
