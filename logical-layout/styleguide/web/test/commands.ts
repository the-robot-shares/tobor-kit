/// <reference types="cypress" />
import {styleguideAsserts} from './asserts';
import {styleguideSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      styleguideVisit(path?: string): void;
      styleguideWaitDefined(tag?: string, timeout?: number): void;
      styleguideMount(tag?: string): void;
      styleguideNoLoadError(): void;
      styleguideClickBtn(tag?: string): void;
      styleguideClickCard(tag?: string): void;
      styleguideBtnVisible(tag?: string): void;
      styleguideCardVisible(tag?: string): void;
      styleguideGridVisible(tag?: string): void;
      styleguideStatusVisible(tag?: string): void;
      styleguideInputVisible(tag?: string): void;
      styleguideSpecVisible(tag?: string): void;
      styleguideStepsVisible(tag?: string): void;
      styleguideTypeInput(value: string, tag?: string): void;
    }
  }
}

Cypress.Commands.add('styleguideVisit', (path = '/') => {
  styleguideSteps.visit(path);
});

Cypress.Commands.add('styleguideWaitDefined', (tag?: string, timeout?: number) => {
  styleguideSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('styleguideMount', (tag = 'noizu-sg-btn') => {
  styleguideSteps.waitDefined(tag);
  styleguideAsserts.mounted(tag);
});

Cypress.Commands.add('styleguideNoLoadError', () => {
  styleguideAsserts.noLoadError();
});

Cypress.Commands.add('styleguideClickBtn', (tag?: string) => {
  styleguideSteps.clickBtn(tag);
});

Cypress.Commands.add('styleguideClickCard', (tag?: string) => {
  styleguideSteps.clickCard(tag);
});

Cypress.Commands.add('styleguideBtnVisible', (tag?: string) => {
  styleguideAsserts.btnVisible(tag);
});

Cypress.Commands.add('styleguideCardVisible', (tag?: string) => {
  styleguideAsserts.cardVisible(tag);
});

Cypress.Commands.add('styleguideGridVisible', (tag?: string) => {
  styleguideAsserts.gridVisible(tag);
});

Cypress.Commands.add('styleguideStatusVisible', (tag?: string) => {
  styleguideAsserts.statusVisible(tag);
});

Cypress.Commands.add('styleguideInputVisible', (tag?: string) => {
  styleguideAsserts.inputVisible(tag);
});

Cypress.Commands.add('styleguideSpecVisible', (tag?: string) => {
  styleguideAsserts.specVisible(tag);
});

Cypress.Commands.add('styleguideStepsVisible', (tag?: string) => {
  styleguideAsserts.stepsVisible(tag);
});

Cypress.Commands.add('styleguideTypeInput', (value: string, tag?: string) => {
  styleguideSteps.typeInput(value, tag);
});

export {};
