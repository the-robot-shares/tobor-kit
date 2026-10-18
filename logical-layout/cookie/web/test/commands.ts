/// <reference types="cypress" />
import {cookieAsserts as asserts} from './asserts';
import {cookieSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      cookieVisit(path?: string): void;
      cookieWaitDefined(tag?: string, timeout?: number): void;
      cookieClearStoredConsent(): void;
      cookieAcceptAll(): void;
      cookieRejectOptional(): void;
      cookieSave(): void;
      cookieOpenSettings(): void;
      cookieMount(tag?: string): void;
      cookieNoLoadError(): void;
      cookieBannerVisible(): void;
      cookieBannerHidden(): void;
      cookieSettingsVisible(): void;
    }
  }
}

Cypress.Commands.add('cookieVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('cookieWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});
Cypress.Commands.add('cookieClearStoredConsent', () => {
  steps.clearStoredConsent();
});
Cypress.Commands.add('cookieAcceptAll', () => {
  steps.acceptAll();
});
Cypress.Commands.add('cookieRejectOptional', () => {
  steps.rejectOptional();
});
Cypress.Commands.add('cookieSave', () => {
  steps.save();
});
Cypress.Commands.add('cookieOpenSettings', () => {
  steps.openSettings();
});
Cypress.Commands.add('cookieMount', (tag = 'noizu-cookie-consent') => {
  steps.waitDefined(tag);
  asserts.mounted(tag);
});
Cypress.Commands.add('cookieNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('cookieBannerVisible', () => {
  asserts.bannerVisible();
});
Cypress.Commands.add('cookieBannerHidden', () => {
  asserts.bannerHidden();
});
Cypress.Commands.add('cookieSettingsVisible', () => {
  asserts.settingsVisible();
});

export {};
