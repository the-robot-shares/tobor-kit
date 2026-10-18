/// <reference types="cypress" />
import {partyCardAsserts as asserts} from '../asserts.js';
import {partyCardSteps as steps} from '../steps.js';

describe('tobor-party-card (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined('tobor-party-card');
    asserts.mounted('tobor-party-card');
    asserts.noLoadError();
    asserts.partyCardVisible();
    asserts.partyHooks();
  });

  it('exposes party identity hooks', () => {
    steps.waitDefined('tobor-party-card');
    asserts.partyCardVisible();
    asserts.partyHooks();
  });
});
