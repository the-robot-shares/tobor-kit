/// <reference types="cypress" />
import type {McpDomainTool, ToolVisibility} from '../types';
import {mcpDomainAsserts as asserts} from './asserts';
import {mcpDomainSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      mcpDomainVisit(path?: string): void;
      mcpDomainWaitDefined(tag?: string, timeout?: number): void;
      mcpDomainMount(): void;
      mcpDomainNoLoadError(): void;
      mcpDomainSetTools(tools?: McpDomainTool[]): void;
      mcpDomainSetVisibility(name: string, visibility: ToolVisibility): void;
      mcpDomainChanged(expected: {name: string; visibility: string}): void;
    }
  }
}

Cypress.Commands.add('mcpDomainVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('mcpDomainWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});
Cypress.Commands.add('mcpDomainMount', () => {
  steps.waitDefined();
  asserts.mounted();
});
Cypress.Commands.add('mcpDomainNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('mcpDomainSetTools', (tools?: McpDomainTool[]) => {
  steps.setTools(tools);
});
Cypress.Commands.add('mcpDomainSetVisibility', (name: string, visibility: ToolVisibility) => {
  steps.setVisibility(name, visibility);
});
Cypress.Commands.add('mcpDomainChanged', (expected: {name: string; visibility: string}) => {
  asserts.lastVisibilityChange(expected);
});

export {};
