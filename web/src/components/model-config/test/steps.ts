/// <reference types="cypress" />
import {inShadow, waitDefined as kitWaitDefined} from '../../../lit-test/cypress.js';

const TAG = 'noizu-model-config';

export const modelConfigSteps = {
  visit(path = '/'): void {
    cy.visit(path);
  },
  waitDefined(tag = TAG, timeout = 15_000): void {
    kitWaitDefined(tag, timeout);
  },
  captureChanges(tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {
        __modelChanges?: {value: string}[];
        __budgetChanges?: {amount: number}[];
        __customSaves?: {baseUrl: string; model: string; apiKey: string}[];
      };
      node.__modelChanges = [];
      node.__budgetChanges = [];
      node.__customSaves = [];
      node.addEventListener('model-change', (event) => {
        node.__modelChanges?.push((event as CustomEvent<{value: string}>).detail);
      });
      node.addEventListener('budget-change', (event) => {
        node.__budgetChanges?.push((event as CustomEvent<{amount: number}>).detail);
      });
      node.addEventListener('custom-endpoint-save', (event) => {
        node.__customSaves?.push(
          (event as CustomEvent<{baseUrl: string; model: string; apiKey: string}>).detail,
        );
      });
    });
  },
  ensureCatalog(
    catalog: {provider: string; model: string; label?: string}[] = [
      {provider: 'openai', model: 'gpt-4o', label: 'GPT-4o'},
      {provider: 'anthropic', model: 'claude-3-5', label: 'Claude 3.5'},
    ],
    tag = TAG,
  ): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {catalog: typeof catalog};
      node.catalog = catalog;
    });
    inShadow(tag, '[data-cy="model.picker"] option').should('have.length.at.least', catalog.length);
  },
  setValue(value: string, tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {value: string};
      node.value = value;
    });
  },
  setInherit(on = true, tag = TAG): void {
    cy.get(tag).then(($el) => {
      const node = $el[0] as HTMLElement & {inherit: boolean};
      node.inherit = on;
      if (on) node.setAttribute('inherit', '');
      else node.removeAttribute('inherit');
    });
  },
  selectSpec(spec: string, tag = TAG): void {
    inShadow(tag, '[data-cy="model.picker"]').select(spec, {force: true});
  },
  saveCustom(tag = TAG): void {
    inShadow(tag, '[data-cy="model.save"]').click();
  },
};
