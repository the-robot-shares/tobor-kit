/// <reference types="cypress" />
import {cookieAsserts as asserts} from '../asserts';
import {cookieSteps as steps} from '../steps';

describe('noizu-cookie-consent (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined();
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted();
    asserts.noLoadError();
  });

  it('accepts all categories and hides the banner', () => {
    // Given first-visit storage
    steps.waitDefined();
    steps.clearStoredConsent();
    steps.waitDefined();
    // When the visitor accepts all
    asserts.bannerVisible();
    asserts.categoriesVisible();
    steps.acceptAll();
    // Then consent is stored and the banner hides
    asserts.bannerHidden();
    asserts.consentWritten(true);
  });

  it('rejects optional categories', () => {
    steps.waitDefined();
    steps.clearStoredConsent();
    steps.waitDefined();
    asserts.bannerVisible();
    steps.rejectOptional();
    asserts.bannerHidden();
    asserts.consentWritten(false);
  });

  it('saves a draft category selection', () => {
    steps.waitDefined();
    steps.clearStoredConsent();
    steps.waitDefined();
    asserts.bannerVisible();
    steps.toggleCategory('Analytics');
    steps.save();
    asserts.bannerHidden();
    cy.get('noizu-cookie-consent').should(($el) => {
      const el = $el[0] as HTMLElement & {storageKey?: string};
      const key = el.storageKey || el.getAttribute('storage-key') || 'start-app.cookie-consent.v1';
      const stored = JSON.parse(el.ownerDocument.defaultView?.localStorage.getItem(key) ?? 'null') as {
        categories: {analytics: boolean; marketing: boolean; preferences: boolean};
      };
      expect(stored.categories.analytics).to.equal(true);
      expect(stored.categories.marketing).to.equal(false);
      expect(stored.categories.preferences).to.equal(false);
    });
  });
});
