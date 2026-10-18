/// <reference types="cypress" />
import {partyCardAsserts as asserts} from '../asserts.js';
import {partyCardSteps as steps} from '../steps.js';

describe('tobor-agent-card (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    steps.waitDefined('tobor-agent-card');
    asserts.mounted('tobor-agent-card');
    asserts.noLoadError();
    asserts.agentCardVisible();
    asserts.chatVisible();
    asserts.partyHooks('tobor-agent-card');
  });

  it('emits agent-chat when Chat is clicked', () => {
    steps.waitDefined('tobor-agent-card');
    asserts.chatVisible();
    steps.captureAgentChat();
    // When the visitor clicks Chat
    steps.clickChat();
    // Then the host receives agent-chat (host opens the conversation)
    cy.get('tobor-agent-card').then(($el) => {
      const id = ($el.get(0) as HTMLElement & {agentId: string}).agentId;
      asserts.lastAgentChat(id);
    });
  });
});
