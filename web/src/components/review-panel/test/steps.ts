/// <reference types="cypress" />
import {inShadow, waitDefined} from '../../../lit-test/cypress.js';

const TAG = 'tobor-review-panel';

export const reviewPanelSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitDefined(tag, timeout);
  },
  typeComposer(value: string, tag = TAG): void {
    inShadow(tag, '[data-cy="review.composer"]').clear().type(value);
  },
  submit(tag = TAG): void {
    inShadow(tag, '[data-cy="review.submit"]').click();
  },
  resolveFirst(tag = TAG): void {
    cy.get(tag).shadow().find('[part="resolve"]').first().click();
  },
  captureEvents(): void {
    cy.window().then((win) => {
      const state = win as Window & {
        __reviewSubmit?: {artifactId: string; body: string};
        __reviewResolve?: {id: string};
      };
      win.document.addEventListener('review-submit', (event) => {
        state.__reviewSubmit = (event as CustomEvent<{artifactId: string; body: string}>).detail;
      });
      win.document.addEventListener('review-resolve', (event) => {
        state.__reviewResolve = (event as CustomEvent<{id: string}>).detail;
      });
    });
  },
  captureErrors(): void {
    cy.window().then((win) => {
      const state = win as Window & {__reviewPanelErrors?: string[]};
      state.__reviewPanelErrors = [];
      win.addEventListener('error', (event) => {
        state.__reviewPanelErrors?.push(String((event as ErrorEvent).message));
      });
      win.addEventListener('unhandledrejection', (event) => {
        state.__reviewPanelErrors?.push(String((event as PromiseRejectionEvent).reason));
      });
    });
  },
};
