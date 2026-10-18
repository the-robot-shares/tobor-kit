/// <reference types="cypress" />
import {partyCardAsserts} from './asserts.js';
import {partyCardSteps} from './steps.js';

declare global {
  namespace Cypress {
    interface Chainable {
      partyCardVisit(path?: string): void;
      partyCardWaitDefined(tag?: string, timeout?: number): void;
      partyCardMount(tag?: string): void;
      partyCardNoLoadError(): void;
      partyCardClickChat(tag?: string): void;
      partyCardClickProfile(tag?: string): void;
      partyCardLastAgentChat(agentId: string): void;
      partyCardLastUserProfile(userId: string): void;
    }
  }
}

Cypress.Commands.add('partyCardVisit', (path?: string) => {
  partyCardSteps.visit(path);
});

Cypress.Commands.add('partyCardWaitDefined', (tag?: string, timeout?: number) => {
  partyCardSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('partyCardMount', (tag = 'tobor-party-card') => {
  partyCardSteps.waitDefined(tag);
  partyCardAsserts.mounted(tag);
});

Cypress.Commands.add('partyCardNoLoadError', () => {
  partyCardAsserts.noLoadError();
});

Cypress.Commands.add('partyCardClickChat', (tag?: string) => {
  partyCardSteps.clickChat(tag);
});

Cypress.Commands.add('partyCardClickProfile', (tag?: string) => {
  partyCardSteps.clickProfile(tag);
});

Cypress.Commands.add('partyCardLastAgentChat', (agentId: string) => {
  partyCardAsserts.lastAgentChat(agentId);
});

Cypress.Commands.add('partyCardLastUserProfile', (userId: string) => {
  partyCardAsserts.lastUserProfile(userId);
});

export {};
