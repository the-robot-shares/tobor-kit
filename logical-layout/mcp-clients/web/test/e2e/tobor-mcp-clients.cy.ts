/// <reference types="cypress" />
import {mcpClientsAsserts as asserts} from '../asserts';
import {mcpClientsSteps as steps} from '../steps';

describe('tobor-mcp-clients (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined();
    asserts.mounted();
    asserts.noLoadError();
    asserts.list();
  });

  it('emits client-authorize and client-revoke', () => {
    steps.waitDefined();
    asserts.mounted();
    steps.captureChanges();
    steps.setClients();
    steps.authorize('github');
    asserts.lastAuthorize({id: 'github'});
    steps.revoke('search');
    asserts.lastRevoke({id: 'search'});
  });
});
