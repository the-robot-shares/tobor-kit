/// <reference types="cypress" />
import type {McpTransport} from '../tobor-mcp-config';
import {mcpConfigAsserts as asserts} from './asserts';
import {mcpConfigSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      mcpConfigVisit(path?: string): void;
      mcpConfigWaitDefined(tag?: string, timeout?: number): void;
      mcpConfigMount(): void;
      mcpConfigNoLoadError(): void;
      mcpConfigSave(): void;
      mcpConfigSetTransport(transport: McpTransport): void;
      mcpConfigChanged(expected: {url: string; transport: string}): void;
    }
  }
}

Cypress.Commands.add('mcpConfigVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('mcpConfigWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});
Cypress.Commands.add('mcpConfigMount', () => {
  steps.waitDefined();
  asserts.mounted();
});
Cypress.Commands.add('mcpConfigNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('mcpConfigSave', () => {
  steps.save();
});
Cypress.Commands.add('mcpConfigSetTransport', (transport: McpTransport) => {
  steps.setTransport(transport);
});
Cypress.Commands.add('mcpConfigChanged', (expected: {url: string; transport: string}) => {
  asserts.lastConfigChange(expected);
});

export {};
