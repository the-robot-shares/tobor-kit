/// <reference types="cypress" />
import {assetAsserts} from './asserts';
import {assetSteps} from './steps';

declare global {
  namespace Cypress {
    interface Chainable {
      assetVisit(path?: string): void;
      assetWaitDefined(tag?: string, timeout?: number): void;
      assetMount(tag?: string): void;
      assetNoLoadError(): void;
      assetClickPreview(tag?: string): void;
      assetSave(tag?: string): void;
      assetViewVisible(tag?: string): void;
      assetEditorVisible(tag?: string): void;
    }
  }
}

Cypress.Commands.add('assetVisit', (path = '/') => {
  assetSteps.visit(path);
});

Cypress.Commands.add('assetWaitDefined', (tag?: string, timeout?: number) => {
  assetSteps.waitDefined(tag, timeout);
});

Cypress.Commands.add('assetMount', (tag = 'tobor-asset-view') => {
  assetSteps.waitDefined(tag);
  assetAsserts.mounted(tag);
});

Cypress.Commands.add('assetNoLoadError', () => {
  assetAsserts.noLoadError();
});

Cypress.Commands.add('assetClickPreview', (tag?: string) => {
  assetSteps.clickPreview(tag);
});

Cypress.Commands.add('assetSave', (tag?: string) => {
  assetSteps.save(tag);
});

Cypress.Commands.add('assetViewVisible', (tag?: string) => {
  assetAsserts.viewVisible(tag);
});

Cypress.Commands.add('assetEditorVisible', (tag?: string) => {
  assetAsserts.editorVisible(tag);
});

export {};
