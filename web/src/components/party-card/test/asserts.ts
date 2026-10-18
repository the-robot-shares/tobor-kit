/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError as kitNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

const PARTY = 'tobor-party-card';
const AGENT = 'tobor-agent-card';
const USER = 'tobor-user-card';

export const partyCardAsserts = {
  mounted(tag = PARTY): void {
    assertMounted(tag);
  },
  catalogMounted(tag = PARTY): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    kitNoLoadError();
  },
  partyHooks(tag = PARTY): void {
    inShadow(tag, '[data-cy="party.name"]').should('exist');
    inShadow(tag, '[data-cy="party.handle"]').should('exist');
    inShadow(tag, '[data-cy="party.presence"]').should('exist');
  },
  partyCardVisible(tag = PARTY): void {
    inShadow(tag, '[data-cy="party.card"]').should('be.visible');
  },
  name(value: string, tag = PARTY): void {
    inShadow(tag, '[data-cy="party.name"]').should('contain', value);
  },
  presence(value: string, tag = PARTY): void {
    inShadow(tag, '[data-cy="party.presence"]').should('have.attr', 'data-presence', value);
  },
  agentCardVisible(tag = AGENT): void {
    inShadow(tag, '[data-cy="agent.card"]').should('be.visible');
  },
  chatVisible(tag = AGENT): void {
    inShadow(tag, '[data-cy="agent.chat"]').should('be.visible');
  },
  capsVisible(tag = AGENT): void {
    inShadow(tag, '[data-cy="agent.caps"]').should('exist');
  },
  lastAgentChat(agentId: string): void {
    cy.window().its('__agentChat').should('deep.equal', {agentId});
  },
  userCardVisible(tag = USER): void {
    inShadow(tag, '[data-cy="user.card"]').should('be.visible');
  },
  profileVisible(tag = USER): void {
    inShadow(tag, '[data-cy="user.profile"]').should('be.visible');
  },
  lastUserProfile(userId: string): void {
    cy.window().its('__userProfile').should('deep.equal', {userId});
  },
};
