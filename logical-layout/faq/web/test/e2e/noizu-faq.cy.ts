/// <reference types="cypress" />
import {faqAsserts as asserts} from '../asserts';
import {faqSteps as steps} from '../steps';

describe('noizu-faq (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads
    steps.waitDefined();
    // Then the island is present without catalog load errors
    asserts.mounted();
    asserts.noLoadError();
    asserts.list();
  });

  it('toggles a slotted details item and emits faq-toggle', () => {
    steps.waitDefined();
    asserts.itemCountAtLeast(1);
    steps.captureToggles();
    // When the host clicks a trigger
    steps.openItem(0);
    // Then the item is open and faq-toggle fired
    asserts.itemOpen(0);
    asserts.lastToggle({open: true, index: 0});
  });

  it('mode=one keeps a single item open', () => {
    steps.waitDefined();
    asserts.itemCountAtLeast(2);
    // When accordion mode opens a second item
    steps.setMode('one');
    steps.openItem(0);
    steps.openItem(1);
    // Then only the latest item stays open
    asserts.onlyItemOpen(1);
  });
});
