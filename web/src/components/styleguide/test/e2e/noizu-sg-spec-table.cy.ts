/// <reference types="cypress" />
import {styleguideAsserts as asserts} from '../asserts';
import {styleguideSteps as steps} from '../steps';

describe('noizu-sg-spec-table (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined('noizu-sg-spec-table');
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted('noizu-sg-spec-table');
    asserts.noLoadError();
    asserts.specVisible();
  });

  it('renders host rows as text', () => {
    steps.waitDefined('noizu-sg-spec-table');
    // When the host supplies rows
    steps.setRows([{key: 'Protocol', value: 'HTTPS'}]);
    // Then the table shows the key/value as text
    asserts.specCellText('Protocol');
    asserts.specCellText('HTTPS');
  });
});
