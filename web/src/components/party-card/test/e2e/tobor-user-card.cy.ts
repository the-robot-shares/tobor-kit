/// <reference types="cypress" />
import {partyCardAsserts as asserts} from '../asserts.js';
import {partyCardSteps as steps} from '../steps.js';

describe('tobor-user-card (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined('tobor-user-card');
    asserts.mounted('tobor-user-card');
    asserts.noLoadError();
    asserts.userCardVisible();
    asserts.profileVisible();
    asserts.partyHooks('tobor-user-card');
  });

  it('emits user-profile when Profile is clicked', () => {
    steps.waitDefined('tobor-user-card');
    asserts.profileVisible();
    steps.captureUserProfile();
    // When the visitor clicks Profile
    steps.clickProfile();
    // Then the host receives user-profile (host opens the profile)
    cy.get('tobor-user-card').then(($el) => {
      const id = ($el.get(0) as HTMLElement & {userId: string}).userId;
      asserts.lastUserProfile(id);
    });
  });
});
