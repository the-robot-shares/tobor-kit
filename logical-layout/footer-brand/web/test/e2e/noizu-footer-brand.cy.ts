/// <reference types="cypress" />
import {footerBrandAsserts as asserts} from '../asserts.js';
import {footerBrandSteps as steps} from '../steps.js';

describe('noizu-footer-brand (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
  });

  it('renders the attribution line with the configured brand link', () => {
    // Given the island is mounted
    steps.waitDefined();
    asserts.mounted();

    // When the host configures the brand pieces
    steps.setAttrs({brand: 'Noizu Labs', prefix: 'Built by', suffix: ''});

    // Then the link reflects the configuration (href from the default)
    asserts.brandText('Noizu Labs');
    asserts.linkHref('https://derobot.is');

    // And no load-error copy is anywhere on the page
    asserts.noLoadError();
  });

  it('hardens the link when the host opens it in a new tab', () => {
    // Given the island is mounted
    steps.waitDefined();
    asserts.mounted();

    // When the host targets a new tab
    steps.setAttrs({target: '_blank'});

    // Then the anchor carries the noopener pair
    asserts.blankRel();
  });
});
