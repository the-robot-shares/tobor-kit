/// <reference types="cypress" />
import {artifactAsserts as asserts} from './asserts';
import {artifactSteps as steps} from './steps';
import type {Artifact} from '../types.js';

declare global {
  namespace Cypress {
    interface Chainable {
      artifactVisit(path?: string): void;
      artifactWaitDefined(tag?: string, timeout?: number): void;
      artifactMount(tag?: string): void;
      artifactNoLoadError(): void;
      artifactSet(artifact?: Artifact, tag?: string): void;
      artifactStartReview(): void;
      artifactSave(): void;
    }
  }
}

Cypress.Commands.add('artifactVisit', (path?: string) => {
  steps.visit(path);
});
Cypress.Commands.add('artifactWaitDefined', (tag?: string, timeout?: number) => {
  steps.waitDefined(tag, timeout);
});
Cypress.Commands.add('artifactMount', (tag = 'tobor-artifact-view') => {
  steps.waitDefined(tag);
  asserts.mounted(tag);
});
Cypress.Commands.add('artifactNoLoadError', () => {
  asserts.noLoadError();
});
Cypress.Commands.add('artifactSet', (artifact?: Artifact, tag?: string) => {
  steps.setArtifact(artifact, tag);
});
Cypress.Commands.add('artifactStartReview', () => {
  steps.startReview();
});
Cypress.Commands.add('artifactSave', () => {
  steps.save();
});

export {};
