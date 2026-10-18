/// <reference types="cypress" />
import {phoneInputAsserts as asserts} from '../asserts.js';
import {phoneInputSteps as steps} from '../steps.js';

describe('noizu-phone-input (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    asserts.hooks();
  });

  it('types digits into an E.164 value', () => {
    steps.waitDefined();
    asserts.hooks();
    steps.captureEvents();
    // When the visitor types a US national number
    steps.typeNational('5551234567');
    // Then value is in-kit E.164
    asserts.e164('+15551234567');
    asserts.lastPhoneChange('+15551234567');
  });

  it('emits country-change from the selector', () => {
    steps.waitDefined();
    steps.captureEvents();
    // When the visitor picks GB
    steps.setCountry('GB');
    // Then country-change reports ISO + dial
    asserts.lastCountryChange({country: 'GB', dial: '+44'});
    asserts.country('GB');
  });
});
