/// <reference types="cypress" />
// Isolation lane: noizu-cookie-consent / noizu-cookie-settings on the blank
// harness page. Consent is localStorage-backed — no backend at all.
const KEY = 'start-app.cookie-consent.v1';
const banner = () => cy.get('noizu-cookie-consent [data-cy="cookie.banner"]');
const events = () => cy.window().then((win: any) => win.__events);

function mountConsent(mode?: string) {
  cy.visit('/e2e/isolation/harness.html');
  return cy.window().then(async (win: any) => {
    win.localStorage.removeItem(KEY);
    await win.mount('noizu-cookie-consent', mode ? {mode} : {});
    win.__events.length = 0;
  });
}

describe('Given the cookie consent family, when a visitor makes choices on the isolation harness, then decisions persist to localStorage and consent events fire', () => {
  it('Given no stored decision, when the banner renders, then it shows category checkboxes and persists an accept-all choice', () => {
    mountConsent();
    banner().should('be.visible');
    cy.get('noizu-cookie-consent [data-cy="cookie.category"]').should('have.length', 4);
    cy.get('noizu-cookie-consent [data-cy="cookie.category"]').first().should('be.disabled');
    cy.screenshot('cookie-banner-first-visit');

    cy.get('noizu-cookie-consent [data-cy="cookie.accept-all"]').click();
    banner().should('not.exist');
    cy.window().then((win: any) => {
      const stored = JSON.parse(win.localStorage.getItem(KEY));
      expect(stored.categories).to.deep.eq({necessary: true, analytics: true, marketing: true, preferences: true});
    });
    events().then((evts: any[]) => {
      const change = evts.find((e) => e.type === 'cookie-consent-change');
      expect(change, 'cookie-consent-change emitted').to.exist;
      expect(change.detail.categories.analytics).to.be.true;
    });
    cy.screenshot('cookie-accepted-banner-gone');
  });

  it('Given a prior decision, when reject-optional is used, then only necessary consent is stored and the banner stays hidden on remount', () => {
    mountConsent();
    cy.get('noizu-cookie-consent [data-cy="cookie.reject-optional"]').click();
    cy.window().then((win: any) => {
      const stored = JSON.parse(win.localStorage.getItem(KEY));
      expect(stored.categories).to.deep.eq({necessary: true, analytics: false, marketing: false, preferences: false});
    });
    // Remount: stored rejection suppresses the banner.
    cy.window().then(async (win: any) => {
      await win.mount('noizu-cookie-consent', {});
    });
    cy.get('noizu-cookie-consent [data-cy="cookie.banner"]').should('not.exist');
    cy.screenshot('cookie-rejected-remount-hidden');
  });

  it('Given a prior decision, when the settings button is clicked, then cookie-settings-open reopens the banner and Save commits the draft', () => {
    mountConsent();
    cy.get('noizu-cookie-consent [data-cy="cookie.accept-all"]').click();
    // Add the settings button as a sibling (win.mount would replace the consent).
    cy.window().then(async (win: any) => {
      // Import in the AUT context (a spec-side import() runs in the spec
      // bundle, not the page).
      await win.eval("import('/dist/components/cookie/noizu-cookie-settings.js')");
      win.__events.length = 0;
      const btn = win.document.createElement('noizu-cookie-settings');
      btn.addEventListener('cookie-settings-open', (e: Event) => win.__events.push({type: e.type, detail: null}));
      win.document.getElementById('mount-root').appendChild(btn);
    });
    cy.get('noizu-cookie-settings [data-cy="cookie.settings"]').should('contain.text', 'Cookie Settings');
    cy.get('noizu-cookie-settings [data-cy="cookie.settings"]').click();
    cy.screenshot('cookie-settings-button');

    banner().should('be.visible');
    events().then((evts: any[]) => {
      expect(evts.some((e) => e.type === 'cookie-settings-open'), 'cookie-settings-open emitted').to.be.true;
    });
    cy.get('noizu-cookie-consent [data-cy="cookie.category"][aria-label="Analytics cookies"]').check();
    cy.get('noizu-cookie-consent [data-cy="cookie.save"]').click();
    cy.window().then((win: any) => {
      const stored = JSON.parse(win.localStorage.getItem(KEY));
      expect(stored.categories.analytics).to.be.true;
      expect(stored.categories.marketing).to.be.true; // from earlier accept-all
    });
    banner().should('not.exist');
    cy.screenshot('cookie-save-draft-committed');
  });
});
