/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';
import type {McpTransport} from '../tobor-mcp-config.js';

const TAG = 'tobor-mcp-config';

export const mcpConfigSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureChanges(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {
        __configChanges?: {url: string; transport: string; extras?: object}[];
      };
      node.__configChanges = [];
      node.addEventListener('config-change', (event) => {
        node.__configChanges?.push(
          (event as CustomEvent<{url: string; transport: string; extras?: object}>).detail,
        );
      });
    });
  },
  setUrl(url: string, tag = TAG): void {
    inShadow(tag, '[part="url"]').clear().type(url, {force: true});
  },
  setTransport(transport: McpTransport, tag = TAG): void {
    inShadow(tag, '[part="transport"]').select(transport, {force: true});
  },
  save(tag = TAG): void {
    inShadow(tag, '[data-cy="mcp.save"]').click();
  },
};
