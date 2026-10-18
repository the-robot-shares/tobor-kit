/// <reference types="cypress" />
import {robotAvatarAsserts} from './asserts.js';
import {robotAvatarSteps} from './steps.js';

declare global {
  namespace Cypress {
    interface Chainable {
      robotAvatarVisit(path?: string): void;
      robotAvatarWaitDefined(tag?: string, timeout?: number): void;
      robotAvatarMount(): void;
      robotAvatarNoLoadError(): void;
      robotAvatarSetState(state: string): void;
      robotAvatarState(value: string): void;
      robotAvatarMotion(value: 'animated' | 'static'): void;
    }
  }
}

Cypress.Commands.add('robotAvatarVisit', (path?: string) => {
  robotAvatarSteps.visit(path);
});

Cypress.Commands.add('robotAvatarWaitDefined', (tag?: string, timeout?: number) => {
  robotAvatarSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('robotAvatarMount', () => {
  robotAvatarSteps.waitDefined();
  robotAvatarAsserts.mounted();
});

Cypress.Commands.add('robotAvatarNoLoadError', () => {
  robotAvatarAsserts.noLoadError();
});

Cypress.Commands.add('robotAvatarSetState', (state: string) => {
  robotAvatarSteps.setState(state);
});

Cypress.Commands.add('robotAvatarState', (value: string) => {
  robotAvatarAsserts.state(value);
});

Cypress.Commands.add('robotAvatarMotion', (value: 'animated' | 'static') => {
  robotAvatarAsserts.motion(value);
});

export {};
