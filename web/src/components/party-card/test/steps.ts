/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';

const PARTY = 'tobor-party-card';
const AGENT = 'tobor-agent-card';
const USER = 'tobor-user-card';

export const partyCardSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = PARTY, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureAgentChat(): void {
    cy.window().then((win) => {
      const state = win as Window & {__agentChat?: {agentId: string}};
      win.document.addEventListener('agent-chat', (event) => {
        state.__agentChat = (event as CustomEvent<{agentId: string}>).detail;
      });
    });
  },
  captureUserProfile(): void {
    cy.window().then((win) => {
      const state = win as Window & {__userProfile?: {userId: string}};
      win.document.addEventListener('user-profile', (event) => {
        state.__userProfile = (event as CustomEvent<{userId: string}>).detail;
      });
    });
  },
  setCapabilities(caps: string[], tag = AGENT): void {
    cy.get(tag).then(($el) => {
      const node = $el.get(0) as HTMLElement & {capabilities: string[]};
      node.capabilities = caps;
    });
  },
  clickChat(tag = AGENT): void {
    inShadow(tag, '[data-cy="agent.chat"]').click();
  },
  clickProfile(tag = USER): void {
    inShadow(tag, '[data-cy="user.profile"]').click();
  },
};
