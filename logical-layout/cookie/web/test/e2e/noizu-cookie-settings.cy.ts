/// <reference types="cypress" />
import {cookieAsserts as asserts} from '../asserts';
import {cookieSteps as steps} from '../steps';

describe('noizu-cookie-settings (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('noizu-cookie-settings');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('noizu-cookie-settings');
    asserts.noLoadError();
    asserts.settingsVisible();
  });

  it('dispatches cookie-settings-open', () => {
    steps.waitDefined('noizu-cookie-settings');
    steps.listenForSettingsOpen();
    steps.openSettings();
    asserts.settingsOpenFired();
  });

  it('reopens the consent banner', () => {
    steps.waitDefined('noizu-cookie-settings');
    steps.waitDefined('noizu-cookie-consent');
    steps.clearStoredConsent();
    steps.waitDefined('noizu-cookie-consent');
    steps.acceptAll();
    asserts.bannerHidden();
    steps.openSettings();
    asserts.bannerVisible();
  });
});
