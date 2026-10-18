/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';
import type {McpClient} from '../tobor-mcp-clients.js';

const TAG = 'tobor-mcp-clients';

export const mcpClientsSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureChanges(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {
        __authorizes?: {id: string}[];
        __revokes?: {id: string}[];
      };
      node.__authorizes = [];
      node.__revokes = [];
      node.addEventListener('client-authorize', (event) => {
        node.__authorizes?.push((event as CustomEvent<{id: string}>).detail);
      });
      node.addEventListener('client-revoke', (event) => {
        node.__revokes?.push((event as CustomEvent<{id: string}>).detail);
      });
    });
  },
  setClients(
    clients: McpClient[] = [
      {id: 'github', name: 'GitHub', status: 'disconnected', auth: 'oauth'},
      {id: 'search', name: 'Search', status: 'connected', auth: 'api-key'},
    ],
    tag = TAG,
  ): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {clients: McpClient[]};
      node.clients = clients;
    });
    inShadow(tag, '[data-cy="mcp.authorize"]').should('have.length.at.least', clients.length);
  },
  authorize(id: string, tag = TAG): void {
    inShadow(tag, `[data-cy="mcp.authorize"][data-client-id="${id}"]`).click();
  },
  revoke(id: string, tag = TAG): void {
    inShadow(tag, `[data-cy="mcp.revoke"][data-client-id="${id}"]`).click();
  },
};
