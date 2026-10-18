/// <reference types="cypress" />
import {voiceAgentAsserts} from './asserts';
import {voiceAgentSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      voiceAgentVisit(path?: string): Chainable<void>;
      voiceAgentWaitDefined(tag?: string, timeout?: number): Chainable<void>;
      voiceAgentMount(tag?: string): Chainable<void>;
      voiceAgentNoLoadError(): Chainable<void>;
      voiceAgentConnect(): Chainable<void>;
      voiceAgentSendText(text: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add('voiceAgentVisit', (path?: string) => {
  voiceAgentSteps.visit(path);
});
Cypress.Commands.add('voiceAgentWaitDefined', (tag?: string, timeout?: number) => {
  voiceAgentSteps.waitDefined(tag, timeout);
});
Cypress.Commands.add('voiceAgentMount', (tag?: string) => {
  voiceAgentSteps.waitDefined(tag);
  voiceAgentAsserts.mounted(tag);
});
Cypress.Commands.add('voiceAgentNoLoadError', () => {
  voiceAgentAsserts.noLoadError();
});
Cypress.Commands.add('voiceAgentConnect', () => {
  voiceAgentSteps.connect();
});
Cypress.Commands.add('voiceAgentSendText', (text: string) => {
  voiceAgentSteps.sendText(text);
});

export {};
