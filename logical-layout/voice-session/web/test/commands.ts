/// <reference types="cypress" />
import {voiceSessionAsserts as asserts} from './asserts';
import {voiceSessionSteps as steps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      voiceSessionVisit(path?: string): void;
      voiceSessionWaitDefined(timeout?: number): void;
      voiceSessionMounted(): void;
      voiceSessionNoLoadError(): void;
      voiceSessionIdle(): void;
      voiceSessionToggle(): void;
      voiceSessionStart(): void;
      voiceSessionStop(): void;
      voiceSessionSendText(text: string): void;
    }
  }
}

Cypress.Commands.add('voiceSessionVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('voiceSessionWaitDefined', (timeout?: number) => {
  steps.waitDefined(undefined, timeout);
});
Cypress.Commands.add('voiceSessionMounted', () => {
  asserts.mounted();
});
Cypress.Commands.add('voiceSessionNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('voiceSessionIdle', () => {
  asserts.idle();
});
Cypress.Commands.add('voiceSessionToggle', () => {
  steps.toggle();
});
Cypress.Commands.add('voiceSessionStart', () => {
  steps.start();
});
Cypress.Commands.add('voiceSessionStop', () => {
  steps.stop();
});
Cypress.Commands.add('voiceSessionSendText', (text: string) => {
  steps.sendText(text);
});

export {};
