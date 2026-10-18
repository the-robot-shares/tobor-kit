/// <reference types="cypress" />
import {inShadow, waitDefined as waitCustomElement} from '../../../lit-test/cypress.js';

const TAG = 'tobor-configurator';

export const configuratorSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    waitCustomElement(tag, timeout);
  },
  apply(tag = TAG): void {
    inShadow(tag, '[data-cy="configurator.apply"]').click();
  },
  setField(name: string, value: string, tag = TAG): void {
    inShadow(tag, `[data-cy="configurator.field"][data-field="${name}"] input, [data-cy="configurator.field"][data-field="${name}"] textarea, [data-cy="configurator.field"][data-field="${name}"] select`)
      .first()
      .clear({force: true})
      .type(value, {force: true});
  },
  captureApply(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {
        __configuratorApply?: {tag: string; attributes: Record<string, unknown>; slots: Record<string, string>}[];
      };
      const log: {tag: string; attributes: Record<string, unknown>; slots: Record<string, string>}[] = [];
      node.__configuratorApply = log;
      node.addEventListener('configurator-apply', (event) => {
        log.push(
          (event as CustomEvent<{tag: string; attributes: Record<string, unknown>; slots: Record<string, string>}>).detail,
        );
      });
    });
  },
};
