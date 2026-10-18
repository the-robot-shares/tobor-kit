/// <reference types="cypress" />
import {byCy, waitDefined} from '../../../lit-test/cypress.js';

const DEFAULT_STORAGE_KEY = 'start-app.cookie-consent.v1';

function storageKeyFrom($el: JQuery<HTMLElement>): string {
  const el = $el[0] as HTMLElement & {storageKey?: string};
  return el.storageKey || el.getAttribute('storage-key') || DEFAULT_STORAGE_KEY;
}

export const cookieSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = 'noizu-cookie-consent', timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  clearStoredConsent(): void {
    cy.get('noizu-cookie-consent').then(($el) => {
      const key = storageKeyFrom($el);
      $el[0].ownerDocument.defaultView?.localStorage.removeItem(key);
    });
    cy.reload();
  },
  acceptAll(): void {
    byCy('cookie.accept-all').click();
  },
  rejectOptional(): void {
    byCy('cookie.reject-optional').click();
  },
  save(): void {
    byCy('cookie.save').click();
  },
  toggleCategory(label: string): void {
    cy.get(`[data-cy="cookie.category"][aria-label="${label} cookies"]`).click();
  },
  openSettings(): void {
    byCy('cookie.settings').click();
  },
  listenForSettingsOpen(): void {
    cy.window().then((win) => {
      win.addEventListener('cookie-settings-open', cy.stub().as('cookieSettingsOpen'));
    });
  },
};
