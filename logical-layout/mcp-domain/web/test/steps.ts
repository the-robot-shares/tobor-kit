/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';
import type {McpDomainTool, ToolVisibility} from '../types.js';

const TAG = 'tobor-mcp-domain';

export const mcpDomainSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureChanges(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {
        __visibilityChanges?: {name: string; visibility: string}[];
      };
      node.__visibilityChanges = [];
      node.addEventListener('tool-visibility-change', (event) => {
        node.__visibilityChanges?.push(
          (event as CustomEvent<{name: string; visibility: string}>).detail,
        );
      });
    });
  },
  setTools(
    tools: McpDomainTool[] = [
      {name: 'Github.PullCreate', visibility: 'visible'},
      {name: 'Filesystem.Write', visibility: 'disabled'},
    ],
    tag = TAG,
  ): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {tools: McpDomainTool[]};
      node.tools = tools;
    });
    inShadow(tag, '[data-cy="mcp.tool"]').should('have.length.at.least', tools.length);
  },
  setVisibility(name: string, visibility: ToolVisibility, tag = TAG): void {
    inShadow(tag, `[data-cy="mcp.tool"][data-tool="${name}"] select`).select(visibility, {
      force: true,
    });
  },
};
