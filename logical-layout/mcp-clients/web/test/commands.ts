/// <reference types="cypress" />
import type {McpClient} from '../tobor-mcp-clients';
import {mcpClientsAsserts as asserts} from './asserts';
import {mcpClientsSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      mcpClientsVisit(path?: string): void;
      mcpClientsWaitDefined(tag?: string, timeout?: number): void;
      mcpClientsMount(): void;
      mcpClientsNoLoadError(): void;
      mcpClientsSetClients(clients?: McpClient[]): void;
      mcpClientsAuthorize(id: string): void;
      mcpClientsRevoke(id: string): void;
    }
  }
}

Cypress.Commands.add('mcpClientsVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('mcpClientsWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});
Cypress.Commands.add('mcpClientsMount', () => {
  steps.waitDefined();
  asserts.mounted();
});
Cypress.Commands.add('mcpClientsNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('mcpClientsSetClients', (clients?: McpClient[]) => {
  steps.setClients(clients);
});
Cypress.Commands.add('mcpClientsAuthorize', (id: string) => {
  steps.authorize(id);
});
Cypress.Commands.add('mcpClientsRevoke', (id: string) => {
  steps.revoke(id);
});

export {};
